import { useMemo, useState } from 'react'
import { Bell, BellOff, Check, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Chip, Separator } from '@/components/ui/controls'
import { CuteEmptyState } from '@/components/ui/cute-empty-state'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ConfirmDialog, ConfirmDialogContent } from '@/components/ui/confirm-dialog'
import { useApp } from '@/app/AppContext'
import { getStorage } from '@/services/persistence'
import { formatClockFromMillis, relativeDayLabel, toDateKey } from '@/lib/date'
import { cn } from '@/lib/utils'
import {
  NOTIFICATION_CATEGORY_LABELS,
  notificationChannelNotice,
  notificationPermission,
  requestNotificationPermission,
  sendTestNotification,
} from '@/services/notifications/notifier'
import type { NotificationLogEntry } from '@/types'

export function NotificationCenter({ unread }: { unread: number }) {
  const { data, settings, reload } = useApp()
  const [open, setOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [permissionNote, setPermissionNote] = useState<string | null>(null)

  const entries = data.notificationLog
  const permission = notificationPermission()

  const grouped = useMemo(() => {
    const map = new Map<string, NotificationLogEntry[]>()
    for (const entry of entries) {
      const key = toDateKey(entry.deliveredAt)
      const list = map.get(key) ?? []
      list.push(entry)
      map.set(key, list)
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [entries])

  const markAllRead = async () => {
    const storage = getStorage()
    for (const entry of entries.filter((item) => !item.read)) {
      await storage.markNotificationRead(entry.id, true)
    }
    reload()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          {permission === 'granted' ? <Bell /> : <BellOff />}
          {unread > 0 ? (
            <span className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-[var(--accent)] px-1 text-[0.58rem] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(94vw,26rem)] p-0">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div>
            <p className="font-display text-sm font-bold">Notification centre</p>
            <p className="text-[0.68rem] text-[var(--fg-subtle)]">
              {entries.length === 0 ? 'Nothing delivered yet' : `${entries.length} recent reminder${entries.length === 1 ? '' : 's'}`}
            </p>
          </div>
          {entries.length > 0 ? (
            <Button variant="ghost" size="icon-sm" onClick={() => void markAllRead()} title="Mark all read">
              <Check />
            </Button>
          ) : null}
        </div>
        <Separator />

        <div className="max-h-[52vh] overflow-y-auto">
          {entries.length === 0 ? (
            <CuteEmptyState
              size="sm"
              mascot="cat"
              title="No reminders yet"
              description="Save an activity with a reminder, or allow browser notifications, and delivered nudges will collect here."
            />
          ) : (
            grouped.map(([date, items]) => (
              <div key={date} className="px-3 py-2">
                <p className="px-1 pb-1 text-[0.62rem] font-bold tracking-[0.12em] text-[var(--fg-subtle)] uppercase">
                  {relativeDayLabel(date)}
                </p>
                <ul className="space-y-1">
                  {items.map((entry) => (
                    <li
                      key={entry.id}
                      className={cn(
                        'rounded-xl border border-[var(--line)] px-3 py-2',
                        entry.read ? 'bg-[var(--surface)]' : 'bg-[var(--accent-soft)]',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[0.78rem] font-semibold text-[var(--fg)]">{entry.title}</p>
                        <span className="shrink-0 text-[0.62rem] text-[var(--fg-subtle)]">
                          {formatClockFromMillis(entry.deliveredAt, settings)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[0.72rem] leading-snug text-[var(--fg-muted)]">{entry.body}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Chip tone="neutral">{NOTIFICATION_CATEGORY_LABELS[entry.category]}</Chip>
                        {entry.channel === 'in-app' ? (
                          <Chip tone="warning">In-app only</Chip>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>

        <Separator />
        <div className="space-y-2 px-4 py-3">
          <p className="text-[0.68rem] leading-relaxed text-[var(--fg-subtle)]">
            {permissionNote ?? notificationChannelNotice()}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {permission !== 'granted' && permission !== 'unsupported' ? (
              <Button
                size="sm"
                variant="soft"
                onClick={async () => {
                  const result = await requestNotificationPermission()
                  setPermissionNote(
                    result === 'granted'
                      ? 'Notifications allowed. Reminders will pop up while the app is open.'
                      : 'Notifications remain blocked. Reminders will only appear here in the app.',
                  )
                }}
              >
                Allow notifications
              </Button>
            ) : null}
            {permission !== 'unsupported' ? (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const channel = await sendTestNotification()
                  setPermissionNote(
                    channel === 'browser'
                      ? 'Test notification sent to your system tray.'
                      : 'Test reminder added here — system notifications are not available right now.',
                  )
                }}
              >
                Send test
              </Button>
            ) : null}
            {entries.length > 0 ? (
              <ConfirmDialog open={confirmClear} onOpenChange={setConfirmClear}>
                <Button size="sm" variant="ghost" onClick={() => setConfirmClear(true)}>
                  <Trash2 />
                  Clear
                </Button>
                <ConfirmDialogContent
                  title="Clear notification history?"
                  description="This removes the delivered reminder log only. Your schedule, tasks and habits are untouched."
                  confirmLabel="Clear history"
                  onConfirm={async () => {
                    await getStorage().clearNotificationLog()
                    setConfirmClear(false)
                    reload()
                  }}
                />
              </ConfirmDialog>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
