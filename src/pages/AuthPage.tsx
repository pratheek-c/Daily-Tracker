import { useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
  UserPlus,
} from 'lucide-react'
import {
  Button,
  Card,
  CardBody,
  Field,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import { Logo } from '@/components/layout/Logo'
import { Mascot } from '@/components/mascots/Mascot'
import { useCloud } from '@/app/CloudContext'
import { useApp } from '@/app/AppContext'
import { cn } from '@/lib/utils'

type Mode = 'signin' | 'signup'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * The first screen of the app.
 *
 * Email + password is the primary credential because it sends no email — the
 * hosted project's built-in mailer is capped at a couple of messages per hour,
 * which is what makes a magic-link-first flow fail with “email rate limit
 * exceeded”. The emailed *code* path is still offered as a fallback for the case
 * where a password has been forgotten and reset mail is rate-limited too.
 */
export function AuthPage() {
  const cloud = useCloud()
  const { saveSettings } = useApp()

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fullName, setFullName] = useState('')
  const [preferredName, setPreferredName] = useState('')
  const [course, setCourse] = useState('')
  const [institution, setInstitution] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null)

  // Magic-link / numeric-code fallback.
  const [magicOpen, setMagicOpen] = useState(false)
  const [code, setCode] = useState('')

  // Password reset.
  const [resetOpen, setResetOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetDone, setResetDone] = useState<string | null>(null)

  const busy =
    cloud.signingIn || cloud.signingUp || cloud.resetting || cloud.sending || cloud.verifying
  const error = localError ?? cloud.error

  function clearFeedback() {
    setLocalError(null)
    setNotice(null)
  }

  async function handleSignIn(event: FormEvent) {
    event.preventDefault()
    clearFeedback()
    if (!EMAIL_RE.test(email.trim())) {
      setLocalError('Enter the email address you signed up with.')
      return
    }
    const ok = await cloud.signInWithPassword(email, password)
    if (ok) setPassword('')
  }

  async function handleSignUp(event: FormEvent) {
    event.preventDefault()
    clearFeedback()
    if (!fullName.trim()) {
      setLocalError('Please tell us your name.')
      return
    }
    if (!EMAIL_RE.test(email.trim())) {
      setLocalError('Enter a valid email address.')
      return
    }
    if (password.length < 6) {
      setLocalError('Choose a password with at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setLocalError('The two passwords do not match.')
      return
    }
    // Fall back to the first word of the full name when no nickname is given.
    const chosenName = preferredName.trim() || fullName.trim().split(/\s+/)[0]
    const outcome = await cloud.signUpWithPassword(email, password, {
      fullName,
      displayName: chosenName,
      course,
      institution,
    })
    if (outcome.ok && chosenName) {
      // Greet the new account by name straight away; this is also the profile
      // the sync engine will mirror once a session exists.
      await saveSettings({ displayName: chosenName })
    }
    if (outcome.ok && outcome.needsConfirmation) {
      setConfirmEmail(email.trim())
    } else if (outcome.ok) {
      setNotice('Account created. Welcome in!')
    }
  }

  async function handleReset(event: FormEvent) {
    event.preventDefault()
    clearFeedback()
    if (!EMAIL_RE.test(resetEmail.trim())) {
      setLocalError('Enter a valid email address.')
      return
    }
    const ok = await cloud.sendPasswordReset(resetEmail)
    if (ok) setResetDone(resetEmail.trim())
  }

  async function handleMagicLink(event: FormEvent) {
    event.preventDefault()
    clearFeedback()
    if (!EMAIL_RE.test(email.trim())) {
      setLocalError('Enter a valid email address.')
      return
    }
    await cloud.signInWithEmail(email)
  }

  async function handleVerifyCode() {
    clearFeedback()
    if (!cloud.linkSentTo) return
    const ok = await cloud.verifyEmailCode(cloud.linkSentTo, code)
    if (ok) setNotice('Signed in. Welcome back!')
  }

  /* A recovery link can land before the sign-in page has finished rendering;
   * hand over to the dedicated screen instead of flashing a login form. */
  if (cloud.recovering) return <PasswordRecoveryPage />

  return (
    <div className="paper-grain grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <header className="mb-5 flex flex-col items-center text-center">
          <Logo className="size-16" />
          <Mascot kind="bunny-crown" className="mt-3 size-28" animate />
          <h1 className="font-display mt-2 text-xl font-bold text-[var(--fg)]">
            Anusree&rsquo;s Daily Tracker
          </h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            {mode === 'signup'
              ? 'Create your account to start planning.'
              : 'Sign in to open your planner.'}
          </p>
        </header>

        <Card>
          <CardBody className="space-y-4">
            {/* -- confirmation pending ------------------------------------- */}
            {confirmEmail ? (
              <div className="space-y-3 text-center">
                <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-ink)]">
                  <Mail className="size-6" />
                </span>
                <h2 className="text-sm font-bold">Confirm your email</h2>
                <p className="text-xs leading-relaxed text-[var(--fg-muted)]">
                  We sent a confirmation link to <strong>{confirmEmail}</strong>. Open it to finish
                  creating your account, then come back and sign in.
                </p>
                {notice ? (
                  <p className="rounded-xl bg-[var(--surface-3)] px-3 py-2 text-[0.7rem] text-[var(--fg-muted)]">
                    {notice}
                  </p>
                ) : null}
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    size="sm"
                    variant="soft"
                    disabled={cloud.sending}
                    onClick={async () => {
                      clearFeedback()
                      const ok = await cloud.resendConfirmation(confirmEmail)
                      if (ok) setNotice('Confirmation email sent again.')
                    }}
                  >
                    <Mail className={cn(cloud.sending && 'animate-pulse')} />
                    Resend email
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      clearFeedback()
                      setConfirmEmail(null)
                      setMode('signin')
                    }}
                  >
                    Back to sign in
                  </Button>
                </div>
                <p className="text-[0.65rem] text-[var(--fg-subtle)]">
                  Tip: confirmation emails are rate-limited. If nothing arrives within an hour, you
                  can still sign in once the link is delivered.
                </p>
              </div>
            ) : null}

            {/* -- password reset ------------------------------------------- */}
            {!confirmEmail && resetOpen ? (
              <form className="space-y-3" onSubmit={handleReset}>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[0.7rem] font-semibold text-[var(--fg-muted)] hover:text-[var(--fg)]"
                  onClick={() => {
                    clearFeedback()
                    setResetOpen(false)
                    setResetDone(null)
                  }}
                >
                  <ArrowLeft className="size-3.5" />
                  Back to sign in
                </button>
                <h2 className="text-sm font-bold">Reset your password</h2>
                {resetDone ? (
                  <>
                    <p className="rounded-xl bg-[var(--surface-3)] px-3 py-2 text-[0.7rem] leading-relaxed text-[var(--fg-muted)]">
                      If an account exists for <strong>{resetDone}</strong>, a reset link is on its
                      way. Open it in this browser to choose a new password.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="soft"
                      onClick={() => {
                        setResetOpen(false)
                        setResetDone(null)
                        setMode('signin')
                      }}
                    >
                      Back to sign in
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-xs leading-relaxed text-[var(--fg-muted)]">
                      We will email you a link to choose a new password.
                    </p>
                    <Field label="Email address" required error={error ?? undefined}>
                      <Input
                        type="email"
                        autoComplete="email"
                        value={resetEmail}
                        onChange={(event) => setResetEmail(event.target.value)}
                        placeholder="you@example.com"
                      />
                    </Field>
                    <Button type="submit" size="sm" disabled={cloud.resetting}>
                      <Mail className={cn(cloud.resetting && 'animate-pulse')} />
                      {cloud.resetting ? 'Sending…' : 'Email me a reset link'}
                    </Button>
                  </>
                )}
              </form>
            ) : null}

            {/* -- sign in / sign up ---------------------------------------- */}
            {!confirmEmail && !resetOpen ? (
              <Tabs
                value={mode}
                onValueChange={(value) => {
                  clearFeedback()
                  setMode(value as Mode)
                  setPassword('')
                  setConfirm('')
                }}
              >
                <TabsList className="w-full">
                  <TabsTrigger value="signin" className="flex-1 justify-center">
                    <LogIn />
                    Sign in
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="flex-1 justify-center">
                    <UserPlus />
                    Create account
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="signin">
                  <form className="space-y-3" onSubmit={handleSignIn}>
                    <Field label="Email address" required>
                      <Input
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@example.com"
                      />
                    </Field>
                    <Field label="Password" required>
                      <PasswordInput
                        value={password}
                        onChange={setPassword}
                        visible={showPassword}
                        onToggle={() => setShowPassword((value) => !value)}
                        autoComplete="current-password"
                        placeholder="Your password"
                      />
                    </Field>

                    {error ? <AuthError message={error} /> : null}
                    {notice ? <AuthNotice message={notice} /> : null}

                    <Button type="submit" className="w-full" disabled={busy}>
                      <LogIn className={cn(cloud.signingIn && 'animate-pulse')} />
                      {cloud.signingIn ? 'Signing in…' : 'Sign in'}
                    </Button>

                    <div className="flex items-center justify-between text-[0.7rem]">
                      <button
                        type="button"
                        className="font-semibold text-[var(--accent-ink)] hover:underline"
                        onClick={() => {
                          clearFeedback()
                          setResetEmail(email)
                          setResetOpen(true)
                        }}
                      >
                        Forgot password?
                      </button>
                      <button
                        type="button"
                        className="font-semibold text-[var(--fg-muted)] hover:text-[var(--fg)]"
                        onClick={() => {
                          clearFeedback()
                          setMagicOpen((value) => !value)
                        }}
                      >
                        {magicOpen ? 'Hide email code' : 'Email me a code'}
                      </button>
                    </div>

                    {magicOpen ? (
                      <div className="space-y-3 rounded-2xl border border-[var(--line)] p-3">
                        {!cloud.linkSentTo ? (
                          <>
                            <p className="text-[0.7rem] leading-relaxed text-[var(--fg-muted)]">
                              We will email a sign-in link and an 8-digit code. Use whichever
                              arrives. Emails are rate-limited, so keep this to occasional use.
                            </p>
                            <Button
                              type="button"
                              size="sm"
                              variant="soft"
                              disabled={cloud.sending}
                              onClick={(event) => void handleMagicLink(event)}
                            >
                              <Mail className={cn(cloud.sending && 'animate-pulse')} />
                              {cloud.sending ? 'Sending…' : 'Email me a code'}
                            </Button>
                          </>
                        ) : (
                          <>
                            <p className="text-[0.7rem] leading-relaxed text-[var(--color-mint-deep)]">
                              Sent to <strong>{cloud.linkSentTo}</strong>. Enter the 8-digit code
                              from the email, or open the link in this browser.
                            </p>
                            <Field label="Code from the email">
                              <Input
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                maxLength={10}
                                value={code}
                                onChange={(event) =>
                                  setCode(event.target.value.replace(/[^\d]/g, ''))
                                }
                                placeholder="12345678"
                                className="w-40 tracking-[0.3em]"
                              />
                            </Field>
                            <Button
                              type="button"
                              size="sm"
                              disabled={cloud.verifying || code.length < 6}
                              onClick={() => void handleVerifyCode()}
                            >
                              <KeyRound className={cn(cloud.verifying && 'animate-pulse')} />
                              {cloud.verifying ? 'Verifying…' : 'Verify code'}
                            </Button>
                          </>
                        )}
                      </div>
                    ) : null}
                  </form>
                </TabsContent>

                <TabsContent value="signup">
                  <form className="space-y-3" onSubmit={handleSignUp}>
                    <Field label="Your name" required>
                      <Input
                        type="text"
                        autoComplete="name"
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        placeholder="Anusree Prakashan"
                      />
                    </Field>
                    <Field
                      label="What should we call you?"
                      hint="Optional — used for greetings. Defaults to your first name."
                    >
                      <Input
                        type="text"
                        autoComplete="nickname"
                        value={preferredName}
                        onChange={(event) => setPreferredName(event.target.value)}
                        placeholder="Anu"
                      />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Course" hint="Optional">
                        <Input
                          type="text"
                          value={course}
                          onChange={(event) => setCourse(event.target.value)}
                          placeholder="Computer Science"
                        />
                      </Field>
                      <Field label="College" hint="Optional">
                        <Input
                          type="text"
                          value={institution}
                          onChange={(event) => setInstitution(event.target.value)}
                          placeholder="Your college"
                        />
                      </Field>
                    </div>
                    <Field label="Email address" required>
                      <Input
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@example.com"
                      />
                    </Field>
                    <Field
                      label="Password"
                      hint="At least 6 characters."
                      required
                    >
                      <PasswordInput
                        value={password}
                        onChange={setPassword}
                        visible={showPassword}
                        onToggle={() => setShowPassword((value) => !value)}
                        autoComplete="new-password"
                        placeholder="Choose a password"
                      />
                    </Field>
                    <Field label="Confirm password" required>
                      <PasswordInput
                        value={confirm}
                        onChange={setConfirm}
                        visible={showPassword}
                        onToggle={() => setShowPassword((value) => !value)}
                        autoComplete="new-password"
                        placeholder="Repeat your password"
                      />
                    </Field>

                    {error ? <AuthError message={error} /> : null}
                    {notice ? <AuthNotice message={notice} /> : null}

                    <Button type="submit" className="w-full" disabled={busy}>
                      <UserPlus className={cn(cloud.signingUp && 'animate-pulse')} />
                      {cloud.signingUp ? 'Creating account…' : 'Create account'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            ) : null}
          </CardBody>
        </Card>

        <p className="mt-4 flex items-start justify-center gap-1.5 text-center text-[0.68rem] text-[var(--fg-subtle)]">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[var(--color-success)]" />
          <span>
            Your planner is saved on this device and mirrored to your private Supabase account. No
            one else can read it.
          </span>
        </p>
      </div>
    </div>
  )
}

/**
 * Shown when a password-recovery link has just signed the user in.
 *
 * The recovery link authenticates the browser, so without this step “forgot
 * password” would only sign you in with your old password unchanged. Here the
 * session is used to set the new one before the planner is shown.
 */
export function PasswordRecoveryPage() {
  const cloud = useCloud()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [visible, setVisible] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const error = localError ?? cloud.error

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLocalError(null)
    if (password.length < 6) {
      setLocalError('Choose a password with at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setLocalError('The two passwords do not match.')
      return
    }
    // On success the auth state clears `recovering`, and the AppShell swaps in
    // the planner automatically.
    await cloud.updatePassword(password)
  }

  return (
    <div className="paper-grain grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <header className="mb-5 flex flex-col items-center text-center">
          <Logo className="size-16" />
          <Mascot kind="bunny" className="mt-3 size-28" animate />
          <h1 className="font-display mt-2 text-xl font-bold text-[var(--fg)]">
            Choose a new password
          </h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Then you are straight back into your planner.
          </p>
        </header>

        <Card>
          <CardBody>
            <form className="space-y-3" onSubmit={handleSubmit}>
              <Field label="New password" hint="At least 6 characters." required>
                <PasswordInput
                  value={password}
                  onChange={setPassword}
                  visible={visible}
                  onToggle={() => setVisible((value) => !value)}
                  autoComplete="new-password"
                  placeholder="Your new password"
                />
              </Field>
              <Field label="Confirm new password" required>
                <PasswordInput
                  value={confirm}
                  onChange={setConfirm}
                  visible={visible}
                  onToggle={() => setVisible((value) => !value)}
                  autoComplete="new-password"
                  placeholder="Repeat your new password"
                />
              </Field>

              {error ? <AuthError message={error} /> : null}

              <Button type="submit" className="w-full" disabled={cloud.updatingPassword}>
                <KeyRound className={cn(cloud.updatingPassword && 'animate-pulse')} />
                {cloud.updatingPassword ? 'Saving…' : 'Save password'}
              </Button>
              <button
                type="button"
                className="w-full text-center text-[0.7rem] font-semibold text-[var(--fg-muted)] hover:text-[var(--fg)]"
                onClick={() => void cloud.cancelRecovery()}
              >
                Cancel and sign out
              </button>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function PasswordInput({
  value,
  onChange,
  visible,
  onToggle,
  autoComplete,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  visible: boolean
  onToggle: () => void
  autoComplete: string
  placeholder?: string
}) {
  return (
    <div className="relative">
      <Lock className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-[var(--fg-subtle)]" />
      <Input
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="pr-10 pl-9"
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-[var(--fg-subtle)] hover:bg-[var(--surface-3)] hover:text-[var(--fg)]"
      >
        {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
    </div>
  )
}

function AuthError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-xl bg-[var(--color-peach)]/50 px-3 py-2 text-[0.7rem] leading-relaxed text-[var(--color-peach-deep)]"
    >
      {message}
    </p>
  )
}

function AuthNotice({ message }: { message: string }) {
  return (
    <p className="rounded-xl bg-[var(--surface-3)] px-3 py-2 text-[0.7rem] leading-relaxed text-[var(--fg-muted)]">
      {message}
    </p>
  )
}
