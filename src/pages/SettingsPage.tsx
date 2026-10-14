import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  BellRing,
  Check,
  Cloud,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  Heart,
  Moon,
  Palette,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Chip,
  Dialog,
  DialogContent,
  Field,
  Input,
  Progress,
  Select,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import { ConfirmDialog, ConfirmDialogContent } from '@/components/ui/confirm-dialog'
import { CloudPanel } from '@/components/cloud/CloudPanel'
import { Mascot, type MascotKind } from '@/components/ui'
import { useApp } from '@/app/AppContext'
import { ACCENT_META, type AccentName } from '@/config/categories'
import { collectDatabaseStats, getDatabase } from '@/db/database'
import {
  NOTIFICATION_HONEST_LIMITATION,
  NOTIFICATION_CATEGORY_LABELS,
  notificationChannelNotice,
  notificationPermission,
  requestNotificationPermission,
  sendTestNotification,
} from '@/services/notifications/notifier'
import {
  activityHistoryCsv,
  applyImport,
  createBackup,
  habitHistoryCsv,
  previewImport,
  sleepRecordsCsv,
  studySessionsCsv,
  tasksCsv,
  type ImportPreview,
} from '@/services/export/backup'
import { buildIcs } from '@/services/export/ics'
import { formatClock, formatMinutes, todayKey, WEEKDAY_LABELS } from '@/lib/date'
import { downloadText } from '@/lib/utils'
import type { NotificationCategory, Weekday } from '@/types'

const MASCOT_CHOICES: { value: 'cat' | 'bunny'; label: string; preview: MascotKind }[] = [
  { value: 'cat', label: 'White cat', preview: 'cat' },
  { value: 'bunny', label: 'Bunny', preview: 'bunny' },
]

export default function SettingsPage() {
  const { data, settings, saveSettings, resetLocalData, reload } = useApp()
  const [stats, setStats] = useState<Awaited<ReturnType<typeof collectDatabaseStats>> | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [importText, setImportText] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge')
  const fileRef = useRef<HTMLInputElement>(null)

  const permission = notificationPermission()
  const { saveSleepSchedule } = useApp()

  useEffect(() => {
    let cancelled = false
    void collectDatabaseStats(getDatabase()).then((result) => {
      if (!cancelled) setStats(result)
    })
    return () => {
      cancelled = true
    }
  }, [data])

  const studyGoalHours = Math.round((settings.weeklyStudyGoalMinutes / 60) * 10) / 10
  const projectGoalHours = Math.round((settings.weeklyProjectGoalMinutes / 60) * 10) / 10
  const sleepGoalHours = Math.round((settings.sleepGoalMinutes / 60) * 10) / 10

  const exportJson = async () => {
    const backup = await createBackup()
    downloadText(
      `anusree-tracker-backup-${todayKey()}.json`,
      JSON.stringify(backup, null, 2),
      'application/json',
    )
    setNotice('Backup downloaded. Keep it somewhere safe — it contains everything you have recorded.')
  }

  const restore = async () => {
    if (!importText) return
    const result = await applyImport(importText, importMode)
    setImportText(null)
    setPreview(null)
    if (fileRef.current) fileRef.current.value = ''
    setNotice(
      `Imported ${result.imported} record${result.imported === 1 ? '' : 's'}${
        result.skipped > 0 ? ` and skipped ${result.skipped} that already existed` : ''
      }.`,
    )
    reload()
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-2">
        <div>
          <h1 className="font-display text-lg font-bold sm:text-xl">Settings</h1>
          <p className="text-xs text-[var(--fg-muted)]">
            Profile, goals, notifications and your local data
          </p>
        </div>
      </header>

      {notice ? (
        <Card>
          <CardBody className="flex items-center gap-2 py-2.5">
            <Check className="size-4 shrink-0 text-[var(--color-success)]" />
            <p className="flex-1 text-xs text-[var(--fg-muted)]">{notice}</p>
            <Button size="sm" variant="ghost" onClick={() => setNotice(null)}>
              Dismiss
            </Button>
          </CardBody>
        </Card>
      ) : null}

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">
            <UserRound />
            Profile
          </TabsTrigger>
          <TabsTrigger value="goals">
            <Target />
            Goals &amp; timers
          </TabsTrigger>
          <TabsTrigger value="sleep">
            <Moon />
            Sleep
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <BellRing />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="cloud">
            <Cloud />
            Cloud sync
          </TabsTrigger>
          <TabsTrigger value="data">
            <Database />
            Data
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------ profile */}
        <TabsContent value="profile">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Your profile" description="Used for greetings and your avatar" icon={<UserRound />} />
              <CardBody className="space-y-3">
                <Field label="Display name">
                  <Input
                    value={settings.displayName}
                    onChange={(event) => void saveSettings({ displayName: event.target.value })}
                    placeholder="Anusree"
                  />
                </Field>

                <div>
                  <p className="mb-1.5 text-xs font-semibold text-[var(--fg-muted)]">Avatar</p>
                  <div className="flex items-center gap-3">
                    <span className="grid size-12 place-items-center overflow-hidden rounded-full bg-[var(--accent-soft)] text-sm font-bold text-[var(--accent-ink)]">
                      {settings.avatarDataUrl ? (
                        <img src={settings.avatarDataUrl} alt="" className="size-full object-cover" />
                      ) : (
                        settings.displayName.slice(0, 2).toUpperCase()
                      )}
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="text-xs"
                      onChange={async (event) => {
                        const file = event.target.files?.[0]
                        if (!file) return
                        if (file.size > 512 * 1024) {
                          setNotice('Please choose an image under 512 KB so it stays fast to load.')
                          return
                        }
                        const reader = new FileReader()
                        reader.onload = () => {
                          void saveSettings({ avatarDataUrl: String(reader.result) })
                        }
                        reader.readAsDataURL(file)
                      }}
                    />
                    {settings.avatarDataUrl ? (
                      <Button size="sm" variant="ghost" onClick={() => void saveSettings({ avatarDataUrl: null })}>
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-semibold text-[var(--fg-muted)]">Mascot</p>
                  <div className="flex gap-2">
                    {MASCOT_CHOICES.map((choice) => (
                      <button
                        key={choice.value}
                        type="button"
                        onClick={() => void saveSettings({ mascot: choice.value })}
                        className={`flex flex-1 flex-col items-center gap-1 rounded-2xl border p-3 transition-colors ${
                          settings.mascot === choice.value
                            ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                            : 'border-[var(--line)] hover:border-[var(--accent)]'
                        }`}
                      >
                        <Mascot kind={choice.preview} className="size-14" />
                        <span className="text-xs font-semibold">{choice.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Look and feel" description="White surfaces with pastel accents" icon={<Palette />} />
              <CardBody className="space-y-3">
                <div>
                  <p className="mb-1.5 text-xs font-semibold text-[var(--fg-muted)]">Theme accent</p>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(ACCENT_META) as AccentName[]).map((key) => {
                      const accent = ACCENT_META[key]
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => void saveSettings({ themeAccent: key })}
                          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            settings.themeAccent === key
                              ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]'
                              : 'border-[var(--line-strong)] text-[var(--fg-muted)] hover:border-[var(--accent)]'
                          }`}
                        >
                          <span className="size-3 rounded-full" style={{ backgroundColor: accent.accent }} />
                          {accent.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Week starts on">
                    <Select
                      value={String(settings.weekStartsOn)}
                      onChange={(event) =>
                        void saveSettings({ weekStartsOn: Number(event.target.value) as Weekday })
                      }
                    >
                      {[1, 0, 6].map((day) => (
                        <option key={day} value={day}>
                          {WEEKDAY_LABELS[day]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Time format">
                    <Select
                      value={settings.timeFormat}
                      onChange={(event) =>
                        void saveSettings({ timeFormat: event.target.value as '12h' | '24h' })
                      }
                    >
                      <option value="12h">12-hour (9:30 PM)</option>
                      <option value="24h">24-hour (21:30)</option>
                    </Select>
                  </Field>
                </div>

                <Field label="Default category for new blocks">
                  <Select
                    value={settings.defaultCategory}
                    onChange={(event) =>
                      void saveSettings({ defaultCategory: event.target.value as never })
                    }
                  >
                    {['study', 'project', 'college', 'assignment', 'personal', 'other'].map((value) => (
                      <option key={value} value={value}>
                        {value[0].toUpperCase() + value.slice(1)}
                      </option>
                    ))}
                  </Select>
                </Field>

                <label className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--line)] p-3">
                  <span>
                    <span className="block text-xs font-semibold">Timer sounds</span>
                    <span className="block text-[0.65rem] text-[var(--fg-subtle)]">
                      A soft chime when a focus or break block ends
                    </span>
                  </span>
                  <Switch
                    checked={settings.soundEnabled}
                    onCheckedChange={(checked) => void saveSettings({ soundEnabled: checked })}
                    aria-label="Timer sounds"
                  />
                </label>

                <p className="text-[0.68rem] text-[var(--fg-subtle)]">
                  A white background with pastel accents stays the default — the theme is intentionally
                  light and low-contrast for long sessions.
                </p>
              </CardBody>
            </Card>
          </div>
        </TabsContent>

        {/* -------------------------------------------------------------- goals */}
        <TabsContent value="goals">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Weekly goals" description="Drive the progress bars everywhere" icon={<Target />} />
              <CardBody className="space-y-3">
                <Field
                  label="Weekly study goal (hours)"
                  hint={`Currently ${formatMinutes(settings.weeklyStudyGoalMinutes)} — about ${(studyGoalHours / 7).toFixed(1)} h per day`}
                >
                  <Input
                    type="number"
                    min={0}
                    max={80}
                    step={0.5}
                    value={studyGoalHours}
                    onChange={(event) =>
                      void saveSettings({
                        weeklyStudyGoalMinutes: Math.round((Number(event.target.value) || 0) * 60),
                      })
                    }
                  />
                </Field>
                <Field
                  label="Weekly project goal (hours)"
                  hint={`Currently ${formatMinutes(settings.weeklyProjectGoalMinutes)}`}
                >
                  <Input
                    type="number"
                    min={0}
                    max={80}
                    step={0.5}
                    value={projectGoalHours}
                    onChange={(event) =>
                      void saveSettings({
                        weeklyProjectGoalMinutes: Math.round((Number(event.target.value) || 0) * 60),
                      })
                    }
                  />
                </Field>
                <Field
                  label="Daily activity goal (hours)"
                  hint={`Currently ${formatMinutes(settings.dailyActivityGoalMinutes)}`}
                >
                  <Input
                    type="number"
                    min={0}
                    max={24}
                    step={0.5}
                    value={Math.round((settings.dailyActivityGoalMinutes / 60) * 10) / 10}
                    onChange={(event) =>
                      void saveSettings({
                        dailyActivityGoalMinutes: Math.round((Number(event.target.value) || 0) * 60),
                      })
                    }
                  />
                </Field>
                <p className="text-[0.68rem] text-[var(--fg-subtle)]">
                  Goals are guides, not grades. Meeting 80% of a realistic goal beats missing 100% of
                  an impossible one.
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Focus timer"
                description="Pomodoro durations and behaviour"
                icon={<Sparkles />}
              />
              <CardBody className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Focus (minutes)">
                    <Input
                      type="number"
                      min={5}
                      max={120}
                      value={settings.focusMinutes}
                      onChange={(event) =>
                        void saveSettings({ focusMinutes: Math.max(5, Number(event.target.value) || 25) })
                      }
                    />
                  </Field>
                  <Field label="Short break (minutes)">
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={settings.shortBreakMinutes}
                      onChange={(event) =>
                        void saveSettings({
                          shortBreakMinutes: Math.max(1, Number(event.target.value) || 5),
                        })
                      }
                    />
                  </Field>
                  <Field label="Long break (minutes)">
                    <Input
                      type="number"
                      min={5}
                      max={90}
                      value={settings.longBreakMinutes}
                      onChange={(event) =>
                        void saveSettings({
                          longBreakMinutes: Math.max(5, Number(event.target.value) || 15),
                        })
                      }
                    />
                  </Field>
                  <Field label="Long break after" hint="Focus blocks">
                    <Input
                      type="number"
                      min={2}
                      max={12}
                      value={settings.longBreakEvery}
                      onChange={(event) =>
                        void saveSettings({
                          longBreakEvery: Math.max(2, Number(event.target.value) || 4),
                        })
                      }
                    />
                  </Field>
                </div>
                <label className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--line)] p-3">
                  <span>
                    <span className="block text-xs font-semibold">Auto-start the next focus block</span>
                    <span className="block text-[0.65rem] text-[var(--fg-subtle)]">
                      After a break finishes, begin the next focus block automatically
                    </span>
                  </span>
                  <Switch
                    checked={settings.autoStartBreaks}
                    onCheckedChange={(checked) => void saveSettings({ autoStartBreaks: checked })}
                    aria-label="Auto start focus"
                  />
                </label>
                <p className="text-[0.68rem] text-[var(--fg-subtle)]">
                  Finished focus blocks are written into your study records automatically, so Pomodoro
                  time is never double-counted or lost.
                </p>
              </CardBody>
            </Card>
          </div>
        </TabsContent>

        {/* -------------------------------------------------------------- sleep */}
        <TabsContent value="sleep">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Sleep goal" description="Used for the sleep progress rings" icon={<Moon />} />
              <CardBody className="space-y-3">
                <Field
                  label="Target sleep per night (hours)"
                  hint={`Currently ${formatMinutes(settings.sleepGoalMinutes)}`}
                >
                  <Input
                    type="number"
                    min={4}
                    max={14}
                    step={0.25}
                    value={sleepGoalHours}
                    onChange={(event) =>
                      void saveSettings({
                        sleepGoalMinutes: Math.round((Number(event.target.value) || 8) * 60),
                      })
                    }
                  />
                </Field>
                <Progress
                  value={Math.min(100, (settings.sleepGoalMinutes / (9 * 60)) * 100)}
                  label={<span>Compared with a 9-hour ceiling</span>}
                  size="sm"
                  barClassName="bg-[var(--color-lavender-deep)]"
                />
                <p className="text-[0.68rem] text-[var(--fg-subtle)]">
                  Most adults need roughly 7–9 hours, but the right number is personal. This app only
                  compares you with the goal you set.
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Schedule reminders"
                description="Minutes before each moment"
                icon={<BellRing />}
              />
              <CardBody className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Wind-down (min before)">
                    <Input
                      type="number"
                      min={0}
                      max={180}
                      value={data.sleepSchedule?.windDownReminderMinutes ?? 30}
                      onChange={(event) =>
                        void saveSleepSchedule({
                          windDownReminderMinutes: Math.max(0, Number(event.target.value) || 0),
                        })
                      }
                    />
                  </Field>
                  <Field label="Bedtime (min before)">
                    <Input
                      type="number"
                      min={0}
                      max={180}
                      value={data.sleepSchedule?.bedtimeReminderMinutes ?? 15}
                      onChange={(event) =>
                        void saveSleepSchedule({
                          bedtimeReminderMinutes: Math.max(0, Number(event.target.value) || 0),
                        })
                      }
                    />
                  </Field>
                  <Field label="Wake-up (min before)">
                    <Input
                      type="number"
                      min={0}
                      max={180}
                      value={data.sleepSchedule?.wakeReminderMinutes ?? 5}
                      onChange={(event) =>
                        void saveSleepSchedule({
                          wakeReminderMinutes: Math.max(0, Number(event.target.value) || 0),
                        })
                      }
                    />
                  </Field>
                </div>

                <div className="space-y-2">
                  {(
                    [
                      ['windDownReminderEnabled', 'Wind-down reminder'],
                      ['bedtimeReminderEnabled', 'Bedtime reminder'],
                      ['wakeReminderEnabled', 'Wake-up reminder'],
                    ] as const
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] px-3 py-2"
                    >
                      <span className="text-xs font-semibold">{label}</span>
                      <Switch
                        checked={data.sleepSchedule?.[key] ?? true}
                        onCheckedChange={(checked) =>
                          void saveSleepSchedule({ [key]: checked } as never)
                        }
                        aria-label={label}
                      />
                    </label>
                  ))}
                </div>

                {data.sleepSchedule ? (
                  <div className="rounded-2xl bg-[var(--surface-3)] p-3 text-[0.68rem] text-[var(--fg-muted)]">
                    <p className="font-semibold text-[var(--fg)]">Tonight</p>
                    <p className="mt-0.5">
                      Wind-down from{' '}
                      {formatClock(
                        (() => {
                          const bedtime = data.sleepSchedule.weekday.bedtime
                          const [h, m] = bedtime.split(':').map(Number)
                          const total = h * 60 + m - data.sleepSchedule.weekday.windDownMinutes
                          return `${String(Math.floor(((total % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((total % 60) + 60) % 60).padStart(2, '0')}`
                        })(),
                        settings,
                      )}{' '}
                      · bedtime {formatClock(data.sleepSchedule.weekday.bedtime, settings)}
                    </p>
                  </div>
                ) : null}

                <p className="text-[0.68rem] text-[var(--fg-subtle)]">
                  Reminders fire while the app is open and are always recorded in the notification
                  centre.
                </p>
              </CardBody>
            </Card>
          </div>
        </TabsContent>

        {/* ------------------------------------------------------ notifications */}
        <TabsContent value="notifications">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Browser notifications"
                description="Permission, test and honest limitations"
                icon={<BellRing />}
              />
              <CardBody className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={permission === 'granted' ? 'success' : permission === 'denied' ? 'danger' : 'warning'}>
                    {permission === 'granted'
                      ? 'Allowed'
                      : permission === 'denied'
                        ? 'Blocked'
                        : permission === 'unsupported'
                          ? 'Not supported'
                          : 'Not requested yet'}
                  </Chip>
                  {permission !== 'granted' && permission !== 'unsupported' ? (
                    <Button
                      size="sm"
                      variant="soft"
                      onClick={async () => {
                        const result = await requestNotificationPermission()
                        await saveSettings({ notificationPermissionAsked: true })
                        setNotice(
                          result === 'granted'
                            ? 'Notifications allowed. Reminders will pop up while the app is open.'
                            : 'Notifications were not allowed. Reminders still appear inside the app.',
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
                        setNotice(
                          channel === 'browser'
                            ? 'Test notification sent.'
                            : 'Test reminder added to the in-app notification centre.',
                        )
                      }}
                    >
                      Send a test
                    </Button>
                  ) : null}
                </div>

                <p className="text-xs leading-relaxed text-[var(--fg-muted)]">
                  {notificationChannelNotice()}
                </p>

                <div className="flex gap-2 rounded-2xl border border-[var(--color-warning)] bg-[var(--color-peach)]/40 p-3">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[var(--color-peach-deep)]" />
                  <p className="text-[0.68rem] leading-relaxed text-[var(--color-peach-deep)]">
                    {NOTIFICATION_HONEST_LIMITATION}
                  </p>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Reminder categories"
                description="Turn individual kinds of reminder on or off"
                icon={<Sparkles />}
              />
              <CardBody className="space-y-2">
                {(Object.keys(NOTIFICATION_CATEGORY_LABELS) as NotificationCategory[]).map((category) => (
                  <label
                    key={category}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] px-3 py-2"
                  >
                    <span className="text-xs font-semibold">
                      {NOTIFICATION_CATEGORY_LABELS[category]}
                    </span>
                    <Switch
                      checked={settings.enabledNotificationCategories[category] ?? true}
                      onCheckedChange={(checked) =>
                        void saveSettings({
                          enabledNotificationCategories: {
                            ...settings.enabledNotificationCategories,
                            [category]: checked,
                          },
                        })
                      }
                      aria-label={NOTIFICATION_CATEGORY_LABELS[category]}
                    />
                  </label>
                ))}
                <p className="text-[0.68rem] text-[var(--fg-subtle)]">
                  Disabling a category stops new reminders for it from being queued. Already delivered
                  reminders stay in the notification centre.
                </p>
              </CardBody>
            </Card>
          </div>
        </TabsContent>

        {/* -------------------------------------------------------------- cloud */}
        <TabsContent value="cloud">
          <div className="grid gap-4 lg:grid-cols-2">
            <CloudPanel />
            <Card>
              <CardHeader
                title="Local-first, cloud-mirrored"
                description="How the two stores relate"
                icon={<ShieldCheck />}
              />
              <CardBody className="space-y-2 text-xs leading-relaxed text-[var(--fg-muted)]">
                <p>
                  IndexedDB on this device is the working store, which is why the app opens instantly
                  and keeps working with no network at all. Supabase mirrors your records so the same
                  planner appears on your laptop and your phone.
                </p>
                <p>
                  Every record carries its own{' '}
                  <code className="rounded bg-[var(--surface-3)] px-1">updatedAt</code> stamp, so the
                  newest edit wins per record and a stale copy can never silently overwrite newer work.
                </p>
                <p>
                  Deletes are recorded as tombstones rather than removed rows, so deleting something on
                  one device does not get resurrected by the other.
                </p>
                <p className="rounded-xl bg-[var(--surface-3)] p-3">
                  <strong className="text-[var(--fg)]">Security.</strong> Row Level Security scopes
                  every table to your own user id, so even with the public anon key in the bundle one
                  signed-in user cannot read another&apos;s data. Only the anon key is shipped; the
                  service-role key never belongs in a <code>VITE_</code> variable.
                </p>
                <p>
                  Signing out or leaving the cloud unconfigured never blocks the app — it simply stops
                  mirroring.
                </p>
              </CardBody>
            </Card>
          </div>
        </TabsContent>

        {/* --------------------------------------------------------------- data */}
        <TabsContent value="data">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Backup and restore"
                description="A complete JSON snapshot of everything on this device"
                icon={<FileJson />}
              />
              <CardBody className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => void exportJson()}>
                    <Download />
                    Download backup
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      fileRef.current?.click()
                    }}
                  >
                    <Upload />
                    Choose a backup file
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={async (event) => {
                      const file = event.target.files?.[0]
                      if (!file) return
                      const text = await file.text()
                      setImportText(text)
                      setPreview(await previewImport(text))
                    }}
                  />
                </div>

                <div className="rounded-2xl bg-[var(--surface-3)] p-3 text-[0.68rem] text-[var(--fg-muted)]">
                  <p className="font-semibold text-[var(--fg)]">What is stored locally</p>
                  <ul className="mt-1 space-y-0.5">
                    <li>{data.events.filter((event) => !event.isSeriesTemplate).length} scheduled blocks ({data.events.filter((event) => event.isSeriesTemplate).length} repeating templates)</li>
                    <li>{data.tasks.length} tasks and assignments</li>
                    <li>{data.studySessions.length} study sessions</li>
                    <li>{data.projects.length} projects with {data.projectTasks.length} tasks</li>
                    <li>{data.habits.length} habits and {data.habitEntries.length} completion records</li>
                    <li>{data.sleepSessions.length} sleep records</li>
                    <li>{data.notificationLog.length} delivered reminders</li>
                    {stats ? (
                      <li>
                        {stats.estimatedBytes !== null
                          ? `About ${(stats.estimatedBytes / 1024 / 1024).toFixed(2)} MB used on this device`
                          : 'Storage usage is not reported by this browser'}
                      </li>
                    ) : null}
                  </ul>
                </div>

                <p className="text-[0.68rem] text-[var(--fg-subtle)]">
                  Nothing is uploaded anywhere. The backup file is the only way your data leaves this
                  browser profile.
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Export for spreadsheets"
                description="CSV files for study, activities, tasks, habits and sleep"
                icon={<FileSpreadsheet />}
              />
              <CardBody className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      downloadText(
                        `study-sessions-${todayKey()}.csv`,
                        studySessionsCsv(data.studySessions, data.subjects),
                        'text/csv;charset=utf-8',
                      )
                    }
                  >
                    <Download />
                    Study sessions
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      downloadText(
                        `activity-history-${todayKey()}.csv`,
                        activityHistoryCsv(data.activities),
                        'text/csv;charset=utf-8',
                      )
                    }
                  >
                    <Download />
                    Activity history
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      downloadText(
                        `tasks-${todayKey()}.csv`,
                        tasksCsv(data.tasks, data.subjects, data.projects),
                        'text/csv;charset=utf-8',
                      )
                    }
                  >
                    <Download />
                    Tasks
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      downloadText(
                        `sleep-records-${todayKey()}.csv`,
                        sleepRecordsCsv(data.sleepSessions),
                        'text/csv;charset=utf-8',
                      )
                    }
                  >
                    <Download />
                    Sleep records
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      downloadText(
                        `habit-history-${todayKey()}.csv`,
                        habitHistoryCsv(data.habits, data.habitEntries),
                        'text/csv;charset=utf-8',
                      )
                    }
                  >
                    <Download />
                    Habit history
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const exportable = data.events.filter(
                        (event) =>
                          !event.isSeriesTemplate ||
                          (event.recurrence !== null && event.status !== 'cancelled'),
                      )
                      downloadText(
                        `calendar-${todayKey()}.ics`,
                        buildIcs(exportable),
                        'text/calendar;charset=utf-8',
                      )
                    }}
                  >
                    <Download />
                    Calendar (.ics)
                  </Button>
                </div>
                <p className="text-[0.68rem] text-[var(--fg-subtle)]">
                  The .ics file imports into Google Calendar, Apple Calendar and Outlook, with
                  repeating blocks kept as real recurrences.
                </p>
              </CardBody>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader
                title="Danger zone"
                description="Reset everything, or clear individual pieces"
                icon={<AlertTriangle />}
              />
              <CardBody className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await resetLocalData()
                      setNotice('Local data cleared. Sensible defaults were restored.')
                      reload()
                    }}
                  >
                    <RotateCcw />
                    Restore defaults
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setConfirmReset(true)}>
                    <Trash2 />
                    Clear all local data
                  </Button>
                </div>
                <p className="flex items-start gap-2 text-[0.68rem] text-[var(--fg-muted)]">
                  <Heart className="mt-0.5 size-3.5 shrink-0 text-[var(--accent)]" />
                  There is no cloud copy. Once local data is cleared it cannot be recovered unless you
                  downloaded a backup first.
                </p>
              </CardBody>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <ConfirmDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <ConfirmDialogContent
          title="Clear all local data?"
          description="Every scheduled block, task, study session, project, habit, sleep record and reminder on this device will be permanently deleted. Download a backup first if you might want any of it back."
          confirmLabel="Delete everything"
          onConfirm={async () => {
            await resetLocalData()
            setConfirmReset(false)
            setNotice('All local data was cleared and default settings restored.')
            reload()
          }}
        />
      </ConfirmDialog>

      <Dialog
        open={importText !== null}
        onOpenChange={(open) => {
          if (!open) {
            setImportText(null)
            setPreview(null)
          }
        }}
      >
        <DialogContent
          title="Review this backup before importing"
          description="Nothing is written until you confirm."
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setImportText(null)
                  setPreview(null)
                }}
              >
                Cancel
              </Button>
              <Button
                variant={importMode === 'replace' ? 'destructive' : 'default'}
                disabled={!preview?.valid}
                onClick={() => void restore()}
              >
                {importMode === 'replace' ? 'Replace everything' : 'Merge into my data'}
              </Button>
            </>
          }
        >
          {!preview ? (
            <p className="text-xs text-[var(--fg-muted)]">Reading the file…</p>
          ) : !preview.valid ? (
            <div className="rounded-2xl border border-[#E4757F] bg-[var(--color-blush)]/40 p-3">
              <p className="text-xs font-semibold text-[#C2545F]">This file cannot be imported</p>
              <p className="mt-1 text-xs text-[var(--fg-muted)]">{preview.error}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Chip tone="success">{preview.total} records</Chip>
                {preview.exportedAt ? (
                  <Chip tone="neutral">
                    Exported {new Date(preview.exportedAt).toLocaleDateString()}
                  </Chip>
                ) : null}
                <Chip tone="neutral">Version {preview.version}</Chip>
              </div>

              <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
                {Object.entries(preview.counts)
                  .filter(([, count]) => count > 0)
                  .map(([table, count]) => (
                    <li
                      key={table}
                      className="flex items-center justify-between rounded-lg bg-[var(--surface-3)] px-2.5 py-1.5"
                    >
                      <span className="text-[var(--fg-muted)]">{table}</span>
                      <span className="font-semibold">
                        {count}
                        {(preview.duplicates[table] ?? 0) > 0 ? (
                          <span className="ml-1.5 text-[0.65rem] font-normal text-[var(--fg-subtle)]">
                            ({preview.duplicates[table]} already here)
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
              </ul>

              <div className="space-y-2 rounded-2xl border border-[var(--line)] p-3">
                <label className="flex items-start gap-2 text-xs">
                  <input
                    type="radio"
                    name="import-mode"
                    checked={importMode === 'merge'}
                    onChange={() => setImportMode('merge')}
                    className="mt-0.5 accent-[var(--accent)]"
                  />
                  <span>
                    <strong>Merge (recommended)</strong> — add records that are not already here and
                    leave everything else untouched.
                  </span>
                </label>
                <label className="flex items-start gap-2 text-xs">
                  <input
                    type="radio"
                    name="import-mode"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="mt-0.5 accent-[var(--accent)]"
                  />
                  <span>
                    <strong>Replace everything</strong> — wipe current records first. Use only when
                    you are restoring onto a fresh device.
                  </span>
                </label>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader
          title="About this app"
          description="Anusree's Daily Tracker"
          icon={<RefreshCw />}
        />
        <CardBody className="space-y-2 text-xs text-[var(--fg-muted)]">
          <p>
            A local-first student planner: timetable, daily planner, study tracker, project manager,
            assignment manager, habit tracker, sleep tracker with a cycle estimator, calendar,
            reminders and analytics. Everything is stored in IndexedDB on this device.
          </p>
          <p className="flex items-start gap-2">
            <Checkbox checked disabled aria-label="Local first" className="mt-0.5" />
            <span>
              No account, no tracking, no analytics beacons. Adding cloud sync later means swapping the
              storage layer, which is already isolated behind an interface.
            </span>
          </p>
          <p className="text-[0.68rem] text-[var(--fg-subtle)]">
            This app is a planning aid. It does not diagnose sleep or health conditions and it is not a
            guaranteed alarm clock.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
