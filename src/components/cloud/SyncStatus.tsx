import { CloudCheck, CloudOff, Loader2, RefreshCw, TriangleAlert } from 'lucide-react'
import { Button, Chip, Popover, PopoverContent, PopoverTrigger } from '@/components/ui'
import { useCloud } from '@/app/CloudContext'
import { formatClockFromMillis } from '@/lib/date'
import { useApp } from '@/app/AppContext'
import { cn } from '@/lib/utils'
import { SYNCED_ENTITIES } from '@/services/cloud/sync'

/**
 * Compact cloud status in the header.
 *
 * The app is local-first, so this indicator is deliberately quiet: when there is
 * no cloud configured it renders nothing at all rather than nagging.
 */
export function SyncStatus({ className }: { className?: string }) {
  const cloud = useCloud()
  const { settings } = useApp()

  if (!cloud.configured) return null

  const signedOut = cloud.status !== 'signed-in'
  const syncing = cloud.phase === 'syncing'
  const offline = cloud.phase === 'offline'
  const failed = cloud.phase === 'error' || Boolean(cloud.lastError)

  const label = signedOut
    ? 'Sign in to sync'
    : syncing
      ? 'Syncing…'
      : offline
        ? 'Offline'
        : failed
          ? 'Sync problem'
          : 'Synced'

  const Icon = signedOut
    ? CloudOff
    : syncing
      ? Loader2
      : offline || failed
        ? TriangleAlert
        : CloudCheck

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'hidden items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[0.68rem] font-semibold transition-colors sm:inline-flex',
            failed
              ? 'border-[var(--color-warning)] text-[var(--color-peach-deep)]'
              : offline
                ? 'border-[var(--line-strong)] text-[var(--fg-muted)]'
                : 'border-[var(--line-strong)] text-[var(--fg-muted)] hover:border-[var(--accent)]',
            className,
          )}
          aria-label={`Cloud sync: ${label}`}
        >
          <Icon className={cn('size-3.5', syncing && 'animate-spin')} />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,20rem)] p-4">
        <p className="font-display text-sm font-bold">Cloud sync</p>
        <p className="mt-1 text-[0.7rem] leading-relaxed text-[var(--fg-muted)]">
          Your planner is stored on this device first. Signing in mirrors it to Supabase so it follows
          you to another device.
        </p>

        <ul className="mt-3 space-y-1.5 text-[0.7rem]">
          <li className="flex items-center justify-between gap-2">
            <span className="text-[var(--fg-muted)]">Account</span>
            <span className="truncate font-semibold">{cloud.email ?? 'Not signed in'}</span>
          </li>
          <li className="flex items-center justify-between gap-2">
            <span className="text-[var(--fg-muted)]">Status</span>
            <Chip tone={failed ? 'warning' : signedOut ? 'neutral' : 'success'}>{label}</Chip>
          </li>
          <li className="flex items-center justify-between gap-2">
            <span className="text-[var(--fg-muted)]">Last sync</span>
            <span className="font-semibold">
              {cloud.lastSyncedAt ? formatClockFromMillis(cloud.lastSyncedAt, settings) : 'Never'}
            </span>
          </li>
          {cloud.pendingLocalChanges > 0 ? (
            <li className="flex items-center justify-between gap-2">
              <span className="text-[var(--fg-muted)]">Waiting to upload</span>
              <span className="font-semibold">{cloud.pendingLocalChanges} change(s)</span>
            </li>
          ) : null}
        </ul>

        {cloud.lastError ? (
          <p className="mt-2 rounded-xl bg-[var(--color-peach)]/50 px-3 py-2 text-[0.68rem] text-[var(--color-peach-deep)]">
            {cloud.lastError}
          </p>
        ) : null}

        <p className="mt-3 text-[0.65rem] text-[var(--fg-subtle)]">
          Synced entities: {SYNCED_ENTITIES.length}. Running timers stay on this device on purpose, so
          two devices can never fight over a stopwatch.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="soft"
            disabled={signedOut || syncing}
            onClick={() => void cloud.syncNow()}
          >
            <RefreshCw className={cn(syncing && 'animate-spin')} />
            Sync now
          </Button>
          <label className="flex items-center gap-2 text-[0.68rem] text-[var(--fg-muted)]">
            <input
              type="checkbox"
              checked={cloud.autoSync}
              onChange={(event) => cloud.setAutoSync(event.target.checked)}
              className="accent-[var(--accent)]"
            />
            Automatic
          </label>
        </div>
      </PopoverContent>
    </Popover>
  )
}
