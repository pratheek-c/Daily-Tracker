import { useEffect, useState } from 'react'
import {
  Cloud,
  CloudUpload,
  KeyRound,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  ConfirmDialog,
  ConfirmDialogContent,
  Field,
  Input,
  Switch,
} from '@/components/ui'
import { useCloud } from '@/app/CloudContext'
import { formatClockFromMillis } from '@/lib/date'
import { cloudConfigurationHint } from '@/services/cloud/supabase'
import { cn } from '@/lib/utils'

/**
 * Cloud sync panel for Settings.
 *
 * When Supabase is not configured this renders the exact configuration steps
 * instead of a broken sign-in form, because a local-only deployment is a
 * supported state rather than an error.
 */
export function CloudPanel() {
  const cloud = useCloud()
  const [email, setEmail] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (cloud.status === 'signed-in' && !cloud.remoteCounts) {
      void cloud.refreshRemoteCounts()
    }
  }, [cloud])

  if (!cloud.configured) {
    return (
      <Card>
        <CardHeader
          title="Cloud sync"
          description="Not configured for this deployment"
          icon={<Cloud />}
        />
        <CardBody className="space-y-3">
          <p className="text-xs leading-relaxed text-[var(--fg-muted)]">
            {cloudConfigurationHint ??
              'Add your Supabase project URL and anon key to enable sync.'}
          </p>
          <ol className="space-y-2 text-[0.72rem] text-[var(--fg-muted)]">
            <li>
              <strong className="text-[var(--fg)]">1.</strong> Create a project at{' '}
              <span className="text-[var(--accent-ink)]">supabase.com</span>.
            </li>
            <li>
              <strong className="text-[var(--fg)]">2.</strong> Run{' '}
              <code className="rounded bg-[var(--surface-3)] px-1">
                supabase/migrations/0001_records.sql
              </code>{' '}
              in the SQL editor. It creates the synced tables and enables row-level security.
            </li>
            <li>
              <strong className="text-[var(--fg)]">3.</strong> Authentication → Providers → enable{' '}
              <strong>Email</strong> (magic link), and add your deployment URL to the redirect
              allow-list.
            </li>
            <li>
              <strong className="text-[var(--fg)]">4.</strong> Copy{' '}
              <code className="rounded bg-[var(--surface-3)] px-1">.env.example</code> to{' '}
              <code className="rounded bg-[var(--surface-3)] px-1">.env.local</code>, fill in{' '}
              <code className="rounded bg-[var(--surface-3)] px-1">VITE_SUPABASE_URL</code> and{' '}
              <code className="rounded bg-[var(--surface-3)] px-1">VITE_SUPABASE_ANON_KEY</code>, and
              add the same two variables to your Vercel project.
            </li>
          </ol>
          <p className="flex items-start gap-2 rounded-xl bg-[var(--surface-3)] p-3 text-[0.68rem] text-[var(--fg-muted)]">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-[var(--color-success)]" />
            Only the anon key belongs in the browser. Never add the service-role key to a{' '}
            <code>VITE_</code> variable — it bypasses row-level security.
          </p>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader
        title="Cloud sync"
        description={
          cloud.status === 'signed-in'
            ? `Signed in as ${cloud.email ?? 'your account'}`
            : 'Sign in to mirror your planner to Supabase'
        }
        icon={<Cloud />}
        action={
          cloud.status === 'signed-in' ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await cloud.signOut()
                setNotice('Signed out. Your planner still works locally on this device.')
              }}
            >
              <LogOut />
              Sign out
            </Button>
          ) : null
        }
      />
      <CardBody className="space-y-3">
        {cloud.status === 'loading' ? (
          <p className="text-xs text-[var(--fg-muted)]">Checking your session…</p>
        ) : null}

        {cloud.status === 'signed-out' ? (
          <form
            className="space-y-3"
            onSubmit={async (event) => {
              event.preventDefault()
              setBusy(true)
              try {
                const sent = await cloud.signInWithEmail(email)
                if (sent) setNotice(null)
              } finally {
                setBusy(false)
              }
            }}
          >
            <Field
              label="Email address"
              hint="We email you a one-time sign-in link. No password to remember."
              error={cloud.error ?? undefined}
              required
            >
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" size="sm" disabled={busy || cloud.sending}>
                <Mail className={cn((busy || cloud.sending) && 'animate-pulse')} />
                {cloud.sending ? 'Sending…' : 'Email me a sign-in link'}
              </Button>
            </div>
            {cloud.linkSentTo ? (
              <p className="rounded-xl bg-[var(--color-mint)]/50 px-3 py-2 text-[0.7rem] text-[var(--color-mint-deep)]">
                A sign-in link is on its way to <strong>{cloud.linkSentTo}</strong>. Open it in this
                browser to finish signing in. Check your spam folder if it does not arrive within a
                minute.
              </p>
            ) : null}
          </form>
        ) : null}

        {cloud.status === 'signed-in' ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Chip
                tone={
                  cloud.phase === 'error'
                    ? 'warning'
                    : cloud.phase === 'offline'
                      ? 'neutral'
                      : cloud.phase === 'syncing'
                        ? 'accent'
                        : 'success'
                }
              >
                {cloud.phase === 'syncing'
                  ? 'Syncing…'
                  : cloud.phase === 'offline'
                    ? 'Offline'
                    : cloud.phase === 'error'
                      ? 'Sync problem'
                      : 'Up to date'}
              </Chip>
              <Chip tone="neutral">
                Last sync{' '}
                {cloud.lastSyncedAt
                  ? formatClockFromMillis(cloud.lastSyncedAt, { timeFormat: '24h' })
                  : 'never'}
              </Chip>
              {cloud.pendingLocalChanges > 0 ? (
                <Chip tone="warning">{cloud.pendingLocalChanges} local change(s) queued</Chip>
              ) : null}
            </div>

            {cloud.lastError ? (
              <p className="flex items-start gap-2 rounded-xl bg-[var(--color-peach)]/50 px-3 py-2 text-[0.7rem] text-[var(--color-peach-deep)]">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                {cloud.lastError}
              </p>
            ) : null}

            {notice ? (
              <p className="rounded-xl bg-[var(--surface-3)] px-3 py-2 text-[0.7rem] text-[var(--fg-muted)]">
                {notice}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" variant="soft" onClick={() => void cloud.syncNow()}>
                <RefreshCw className={cn(cloud.phase === 'syncing' && 'animate-spin')} />
                Sync now
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  setBusy(true)
                  try {
                    const outcome = await cloud.uploadEverything()
                    setNotice(
                      outcome.ok
                        ? `Uploaded ${outcome.pushed} record(s) from this device.`
                        : `Upload failed: ${outcome.error}`,
                    )
                  } finally {
                    setBusy(false)
                  }
                }}
                disabled={busy}
              >
                <CloudUpload />
                Upload this device again
              </Button>
              <label className="flex items-center gap-2 text-[0.72rem] text-[var(--fg-muted)]">
                <Switch
                  checked={cloud.autoSync}
                  onCheckedChange={cloud.setAutoSync}
                  aria-label="Automatic sync"
                />
                Sync automatically
              </label>
            </div>

            {cloud.remoteCounts && cloud.remoteCounts.length > 0 ? (
              <div className="rounded-2xl bg-[var(--surface-3)] p-3">
                <p className="text-[0.7rem] font-semibold text-[var(--fg)]">On the server</p>
                <ul className="mt-1.5 grid gap-1 text-[0.68rem] sm:grid-cols-2">
                  {cloud.remoteCounts
                    .slice()
                    .sort((a, b) => b.live - a.live)
                    .map((row) => (
                      <li key={row.entity} className="flex items-center justify-between gap-2">
                        <span className="truncate text-[var(--fg-muted)]">{row.entity}</span>
                        <span className="font-semibold">
                          {row.live}
                          {row.tombstones > 0 ? (
                            <span className="ml-1 font-normal text-[var(--fg-subtle)]">
                              +{row.tombstones} deleted
                            </span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}

            <div className="space-y-2 rounded-2xl border border-[var(--line)] p-3">
              <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold">
                <KeyRound className="size-3.5" />
                How conflicts are resolved
              </p>
              <p className="text-[0.68rem] leading-relaxed text-[var(--fg-muted)]">
                The newest edit wins, per record, using each record&apos;s own{' '}
                <code className="rounded bg-[var(--surface-3)] px-1">updatedAt</code> stamp. Deletes
                are recorded as tombstones so removing something on one device does not get undone by
                a stale copy on another. Running timers are never synced — two devices fighting over
                one stopwatch would be worse than useful.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3">
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
              >
                <Trash2 />
                Delete cloud data
              </Button>
              <p className="text-[0.68rem] text-[var(--fg-subtle)]">
                Removes everything this account stored on Supabase. This device keeps its local copy.
              </p>
            </div>
          </>
        ) : null}
      </CardBody>

      <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <ConfirmDialogContent
          title="Delete all cloud data?"
          description="Every record this account stored on Supabase is permanently removed. Your copy on this device is untouched, and you can upload it again at any time."
          confirmLabel="Delete cloud data"
          onConfirm={async () => {
            setBusy(true)
            try {
              const outcome = await cloud.deleteCloudData()
              setNotice(
                outcome.ok
                  ? 'Cloud data deleted. This device still has your local copy.'
                  : `Could not delete cloud data: ${outcome.error}`,
              )
            } finally {
              setBusy(false)
              setConfirmDelete(false)
            }
          }}
        />
      </ConfirmDialog>
    </Card>
  )
}
