import { useCallback, useMemo, useState } from 'react'
import { BedDouble, Moon, MoreHorizontal, Sunrise, Trash2 } from 'lucide-react'
import { Button, Card, CardBody, CardHeader, Chip, Field, Input, Progress, Textarea } from '@/components/ui'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CuteEmptyState, Mascot } from '@/components/ui'
import { useApp } from '@/app/AppContext'
import { computeSessionMath, currentNight, plannedNight } from '@/services/scheduling/sleep-events'
import { formatClock, formatMinutes, toDateKey, todayKey } from '@/lib/date'
import { newId } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { SleepSession } from '@/types'

export interface SleepCardProps {
  className?: string
  compact?: boolean
  /** Make the whole card a link target for the sleep page. */
  onOpenSleepPage?: () => void
}

/**
 * Sleep overview for the dashboard.
 *
 * It distinguishes time in bed from estimated sleep, and never marks a night as
 * completed without a recorded or manually confirmed session.
 */
export function SleepCard({ className, compact, onOpenSleepPage }: SleepCardProps) {
  const { data, settings, now, saveSleepSession, deleteSleepSession } = useApp()
  const [editing, setEditing] = useState<SleepSession | null>(null)
  const [manualOpen, setManualOpen] = useState(false)

  const schedule = data.sleepSchedule
  const tonight = useMemo(() => {
    if (!schedule) return null
    const active = currentNight(schedule, data.sleepExceptions, now)
    return plannedNight(schedule, active?.date ?? todayKey(), data.sleepExceptions)
  }, [schedule, data.sleepExceptions, now])

  const activeSession = data.sleepSessions.find((session) => session.endAt === null)
  const latest = [...data.sleepSessions]
    .filter((session) => session.endAt !== null || session.id === activeSession?.id)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0]

  const sleepMinutes = latest
    ? (latest.estimatedSleepMinutes ?? latest.timeInBedMinutes)
    : null

  const weekSessions = data.sleepSessions
    .filter((session) => session.endAt !== null)
    .slice(-7)
  const weekAverage =
    weekSessions.length === 0
      ? null
      : Math.round(
          weekSessions.reduce(
            (total, session) => total + (session.estimatedSleepMinutes ?? session.timeInBedMinutes),
            0,
          ) / weekSessions.length,
        )

  const startSleep = useCallback(async () => {
    if (activeSession) return
    const stamp = Date.now()
    const session: SleepSession = {
      id: newId('sleep'),
      date: todayKey(),
      startAt: stamp,
      endAt: null,
      sleepOnsetAt: null,
      awakenings: [],
      awakeMinutes: 0,
      timeInBedMinutes: 0,
      estimatedSleepMinutes: null,
      manual: false,
      confirmed: false,
      quality: null,
      notes: '',
      createdAt: stamp,
      updatedAt: stamp,
    }
    await saveSleepSession(session)
  }, [activeSession, saveSleepSession])

  const endSleep = useCallback(async () => {
    if (!activeSession) return
    const stamp = Date.now()
    const maths = computeSessionMath({ ...activeSession, endAt: stamp })
    await saveSleepSession({
      ...activeSession,
      endAt: stamp,
      // Default the onset estimate to the planned onset delay so the estimate is
      // meaningful, while still being editable afterwards.
      sleepOnsetAt:
        activeSession.sleepOnsetAt ??
        activeSession.startAt + (tonight?.sleepOnsetMinutes ?? 15) * 60_000,
      timeInBedMinutes: maths.timeInBedMinutes,
      estimatedSleepMinutes: maths.estimatedSleepMinutes,
      confirmed: true,
    })
    setEditing({
      ...activeSession,
      endAt: stamp,
      timeInBedMinutes: maths.timeInBedMinutes,
      estimatedSleepMinutes: maths.estimatedSleepMinutes,
    })
  }, [activeSession, saveSleepSession, tonight])

  const goalProgress = sleepMinutes === null ? 0 : (sleepMinutes / settings.sleepGoalMinutes) * 100

  return (
    <Card className={className}>
      <CardHeader
        title="Sleep"
        description={
          tonight ? `Planned ${formatClock(tonight.bedtime, settings)} → ${formatClock(tonight.wakeTime, settings)}` : 'No schedule set'
        }
        icon={<Moon />}
        action={
          onOpenSleepPage ? (
            <Button size="sm" variant="ghost" onClick={onOpenSleepPage}>
              <MoreHorizontal />
              Details
            </Button>
          ) : null
        }
      />
      <CardBody className={cn('space-y-3', compact && 'space-y-2')}>
        {!schedule?.enabled ? (
          <CuteEmptyState
            size="sm"
            mascot="sleeping-bunny"
            title="Sleep schedule is off"
            description="Turn it on in Settings or on the Sleep page to plan bedtime and wake-up reminders."
            action={
              onOpenSleepPage ? (
                <Button size="sm" onClick={onOpenSleepPage}>
                  Set up sleep schedule
                </Button>
              ) : null
            }
          />
        ) : null}

        <div className="flex items-center gap-3 rounded-2xl bg-[var(--surface-3)] p-3">
          <Mascot kind="sleeping-cat" className="size-14 shrink-0" animate />
          <div className="min-w-0 flex-1">
            {activeSession ? (
              <>
                <p className="text-xs font-semibold text-[var(--accent-ink)]">Sleep session running</p>
                <p className="text-[0.68rem] text-[var(--fg-muted)]">
                  In bed since {new Date(activeSession.startAt).toLocaleTimeString()}
                </p>
                <Button size="sm" className="mt-1.5" onClick={() => void endSleep()}>
                  <Sunrise />
                  I&rsquo;m awake
                </Button>
              </>
            ) : latest ? (
              <>
                <p className="font-display text-xl leading-none font-bold">
                  {latest.estimatedSleepMinutes === null
                    ? formatMinutes(latest.timeInBedMinutes)
                    : formatMinutes(latest.estimatedSleepMinutes)}
                </p>
                <p className="mt-0.5 text-[0.68rem] text-[var(--fg-muted)]">
                  {latest.estimatedSleepMinutes === null
                    ? 'Time in bed (onset not recorded)'
                    : 'Estimated sleep'}
                  {' · '}
                  {formatMinutes(latest.timeInBedMinutes)} in bed
                </p>
                <p className="text-[0.62rem] text-[var(--fg-subtle)]">
                  {latest.date}
                  {latest.manual ? ' · manual entry' : ''}
                  {latest.confirmed ? ' · confirmed' : ' · not confirmed'}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Button size="sm" variant="soft" onClick={() => void startSleep()}>
                    <BedDouble />
                    Start sleep
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setManualOpen(true)}>
                    Log a night
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold">No sleep recorded yet</p>
                <p className="text-[0.68rem] text-[var(--fg-muted)]">
                  Start a session before bed, or log last night manually.
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Button size="sm" onClick={() => void startSleep()}>
                    <BedDouble />
                    Start sleep
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setManualOpen(true)}>
                    Log last night
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        {sleepMinutes !== null ? (
          <div className="space-y-1.5">
            <Progress
              value={Math.min(100, Math.max(0, goalProgress))}
              label={
                <span>
                  Sleep goal · {formatMinutes(sleepMinutes)} of {formatMinutes(settings.sleepGoalMinutes)}
                </span>
              }
              size="sm"
            />
            <div className="flex flex-wrap gap-1.5">
              {weekAverage !== null ? (
                <Chip tone="neutral">7-night average {formatMinutes(weekAverage)}</Chip>
              ) : null}
              {tonight ? <Chip tone="accent">Wind-down {formatClock(tonight.windDownStart, settings)}</Chip> : null}
            </div>
          </div>
        ) : null}

        {data.sleepSessions.length > 0 ? (
          <ul className="space-y-1">
            {data.sleepSessions
              .filter((session) => session.endAt !== null)
              .sort((a, b) => (a.date < b.date ? 1 : -1))
              .slice(0, compact ? 3 : 5)
              .map((session) => (
                <li
                  key={session.id}
                  className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-2.5 py-1.5 text-xs"
                >
                  <span className="w-20 shrink-0 text-[var(--fg-muted)]">{session.date.slice(5)}</span>
                  <span className="flex-1 truncate">
                    {new Date(session.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' → '}
                    {session.endAt
                      ? new Date(session.endAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </span>
                  <span className="font-semibold">
                    {formatMinutes(session.estimatedSleepMinutes ?? session.timeInBedMinutes)}
                  </span>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Edit or delete this night"
                    onClick={() => setEditing(session)}
                  >
                    <MoreHorizontal />
                  </Button>
                </li>
              ))}
          </ul>
        ) : null}
      </CardBody>

      {editing ? (
        <SleepSessionEditor
          session={editing}
          onClose={() => setEditing(null)}
          onDelete={async () => {
            await deleteSleepSession(editing.id)
            setEditing(null)
          }}
        />
      ) : null}

      {manualOpen ? (
        <ManualNightDialog
          onClose={() => setManualOpen(false)}
          onSave={async (session) => {
            await saveSleepSession(session)
            setManualOpen(false)
          }}
        />
      ) : null}
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/* Editors                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Inline editor for a recorded night.
 *
 * Rendered by the caller (in a row or a popover) rather than owning a dialog, so
 * it composes inside cards, lists and popovers without nested modals.
 */
export function SleepSessionFields({
  session,
  onClose,
  onDelete,
}: {
  session: SleepSession
  onClose: () => void
  onDelete: () => Promise<void>
}) {
  const { saveSleepSession } = useApp()
  const [onset, setOnset] = useState(
    session.sleepOnsetAt ? toLocalInput(session.sleepOnsetAt) : '',
  )
  const [awake, setAwake] = useState(String(session.awakeMinutes))
  const [quality, setQuality] = useState(session.quality ? String(session.quality) : '')
  const [notes, setNotes] = useState(session.notes)

  const preview = computeSessionMath({
    ...session,
    sleepOnsetAt: onset ? new Date(onset).getTime() : null,
    awakeMinutes: Number(awake) || 0,
  })

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-[var(--surface-3)] px-3 py-2 text-[0.7rem] text-[var(--fg-muted)]">
        <p>
          Time in bed:{' '}
          <strong className="text-[var(--fg)]">{formatMinutes(preview.timeInBedMinutes)}</strong>
        </p>
        <p>
          Estimated sleep:{' '}
          <strong className="text-[var(--fg)]">
            {preview.estimatedSleepMinutes === null
              ? 'add a sleep onset estimate'
              : formatMinutes(preview.estimatedSleepMinutes)}
          </strong>
        </p>
      </div>

      <Field label="Estimated sleep onset" hint="Leave empty if you do not know">
        <Input
          type="datetime-local"
          value={onset}
          onChange={(event) => setOnset(event.target.value)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Awake (minutes)">
          <Input
            type="number"
            min={0}
            max={1440}
            value={awake}
            onChange={(event) => setAwake(event.target.value)}
          />
        </Field>
        <Field label="How did it feel?">
          <Input
            type="number"
            min={1}
            max={5}
            value={quality}
            onChange={(event) => setQuality(event.target.value)}
            placeholder="1–5"
          />
        </Field>
      </div>

      <Field label="Notes">
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>

      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="ghost" className="mr-auto text-[#C2545F]" onClick={() => void onDelete()}>
          <Trash2 />
          Delete
        </Button>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={async () => {
            await saveSleepSession({
              ...session,
              sleepOnsetAt: onset ? new Date(onset).getTime() : null,
              awakeMinutes: Number(awake) || 0,
              quality: quality
                ? (Math.min(5, Math.max(1, Number(quality))) as 1 | 2 | 3 | 4 | 5)
                : null,
              notes,
              confirmed: true,
            })
            onClose()
          }}
        >
          Save
        </Button>
      </div>
    </div>
  )
}

export function SleepSessionEditor({
  session,
  onClose,
  onDelete,
}: {
  session: SleepSession
  onClose: () => void
  onDelete: () => Promise<void>
}) {
  return (
    <Popover open onOpenChange={(open) => !open && onClose()}>
      <PopoverTrigger asChild>
        <span className="sr-only">Sleep record editor</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(92vw,22rem)] p-4">
        <p className="font-display mb-3 text-sm font-bold">Night of {session.date}</p>
        <SleepSessionFields session={session} onClose={onClose} onDelete={onDelete} />
      </PopoverContent>
    </Popover>
  )
}

export function ManualNightDialog({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (session: SleepSession) => Promise<void>
}) {
  const [date, setDate] = useState(() => toDateKey(Date.now() - 86_400_000))
  const [bedtime, setBedtime] = useState('23:00')
  const [wakeTime, setWakeTime] = useState('07:00')
  const [onsetMinutes, setOnsetMinutes] = useState('15')
  const [awake, setAwake] = useState('0')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const preview = useMemo(() => {
    const start = new Date(`${date}T${bedtime}:00`).getTime()
    const wakeSameDay = new Date(`${date}T${wakeTime}:00`).getTime()
    const end = wakeSameDay <= start ? wakeSameDay + 86_400_000 : wakeSameDay
    const onset = start + (Number(onsetMinutes) || 0) * 60_000
    return computeSessionMath({
      startAt: start,
      endAt: end,
      sleepOnsetAt: onset,
      awakeMinutes: Number(awake) || 0,
      awakenings: [],
    })
  }, [date, bedtime, wakeTime, onsetMinutes, awake])

  return (
    <Popover open onOpenChange={(open) => !open && onClose()}>
      <PopoverTrigger asChild>
        <span className="sr-only">Log a past night</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(92vw,22rem)] p-4">
        <p className="font-display mb-3 text-sm font-bold">Log a past night</p>
        <div className="space-y-3">
          <Field label="Night of" hint="The date you went to bed">
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bedtime">
              <Input type="time" value={bedtime} onChange={(event) => setBedtime(event.target.value)} />
            </Field>
            <Field label="Woke up">
              <Input type="time" value={wakeTime} onChange={(event) => setWakeTime(event.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Minutes to fall asleep">
              <Input
                type="number"
                min={0}
                max={240}
                value={onsetMinutes}
                onChange={(event) => setOnsetMinutes(event.target.value)}
              />
            </Field>
            <Field label="Awake during night">
              <Input
                type="number"
                min={0}
                max={600}
                value={awake}
                onChange={(event) => setAwake(event.target.value)}
              />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>

          <div className="rounded-xl bg-[var(--surface-3)] px-3 py-2 text-[0.7rem]">
            Time in bed {formatMinutes(preview.timeInBedMinutes)} · estimated sleep{' '}
            <strong>{preview.estimatedSleepMinutes === null ? '—' : formatMinutes(preview.estimatedSleepMinutes)}</strong>
          </div>

          {error ? <p className="text-xs font-semibold text-[#C2545F]">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                if (preview.timeInBedMinutes <= 0) {
                  setError('Wake-up time must be after bedtime.')
                  return
                }
                if (preview.timeInBedMinutes > 20 * 60) {
                  setError('That is more than 20 hours in bed — please check the times.')
                  return
                }
                const start = new Date(`${date}T${bedtime}:00`).getTime()
                const wakeSameDay = new Date(`${date}T${wakeTime}:00`).getTime()
                const end = wakeSameDay <= start ? wakeSameDay + 86_400_000 : wakeSameDay
                const stamp = Date.now()
                await onSave({
                  id: newId('sleep'),
                  date,
                  startAt: start,
                  endAt: end,
                  sleepOnsetAt: start + (Number(onsetMinutes) || 0) * 60_000,
                  awakenings: [],
                  awakeMinutes: Number(awake) || 0,
                  timeInBedMinutes: preview.timeInBedMinutes,
                  estimatedSleepMinutes: preview.estimatedSleepMinutes,
                  manual: true,
                  confirmed: true,
                  quality: null,
                  notes,
                  createdAt: stamp,
                  updatedAt: stamp,
                })
              }}
            >
              Save night
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function toLocalInput(ms: number) {
  const date = new Date(ms)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
