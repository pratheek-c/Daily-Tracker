import { useState } from 'react'
import { BookOpenCheck, Check, Clock, Pause, Play, SquarePen, X } from 'lucide-react'
import { Button, Card, CardBody, CardHeader, Chip, Field, Input, Select, Textarea } from '@/components/ui'
import { useApp } from '@/app/AppContext'
import { useStudyTimer } from '@/hooks/useTimers'
import { formatMinutes, formatSeconds } from '@/lib/utils'

export interface StudyTimerProps {
  className?: string
  /** Optional event this session is being tracked against. */
  eventId?: string | null
  projectTaskId?: string | null
  taskId?: string | null
}

/**
 * Free-form study stopwatch.
 *
 * Only one session may exist at a time; the control disables starting a second
 * one instead of silently stacking timers.
 */
export function StudyTimer({ className, eventId = null, projectTaskId = null, taskId = null }: StudyTimerProps) {
  const { data } = useApp()
  const timer = useStudyTimer()
  const [subjectId, setSubjectId] = useState('')
  const [notes, setNotes] = useState('')
  const [manualOpen, setManualOpen] = useState(false)
  const [manualMinutes, setManualMinutes] = useState('')

  const session = timer.activeSession
  const linkedSubject = data.subjects.find((subject) => subject.id === (session?.subjectId ?? subjectId))

  return (
    <Card className={className}>
      <CardHeader
        title="Study session"
        description={
          session
            ? `${linkedSubject?.name ?? 'Unassigned'} · started ${new Date(session.startedAt).toLocaleTimeString()}`
            : 'Track real study time against a subject'
        }
        icon={<BookOpenCheck />}
        action={
          session ? (
            <Chip tone={timer.running ? 'accent' : 'warning'}>{timer.running ? 'Running' : 'Paused'}</Chip>
          ) : null
        }
      />
      <CardBody className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface-3)] px-4 py-3">
          <div>
            <p className="font-display text-3xl leading-none font-bold tabular-nums">{timer.label}</p>
            <p className="mt-1 text-[0.68rem] text-[var(--fg-muted)]">
              {timer.running
                ? 'Timer is running — it keeps counting if you reload'
                : session
                  ? 'Paused'
                  : 'Not started'}
            </p>
          </div>
          <Clock className="size-7 text-[var(--accent)]" />
        </div>

        {!session ? (
          <>
            <Field label="Subject" hint="Optional — leave blank to log general study">
              <Select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
                <option value="">General study</option>
                {data.subjects
                  .filter((subject) => !subject.archived)
                  .map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  void timer.start({
                    subjectId: subjectId || null,
                    eventId,
                    projectTaskId,
                    taskId,
                    projectId: null,
                  })
                }
              >
                <Play />
                Start session
              </Button>
              <Button variant="ghost" onClick={() => setManualOpen((value) => !value)}>
                <SquarePen />
                Log past session
              </Button>
            </div>
          </>
        ) : (
          <>
            <Field label="Notes for this session">
              <Textarea
                value={notes || session.notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="What did you cover?"
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              {timer.running ? (
                <Button variant="outline" onClick={() => void timer.pause()}>
                  <Pause />
                  Pause
                </Button>
              ) : (
                <Button onClick={() => void timer.resume()}>
                  <Play />
                  Resume
                </Button>
              )}
              <Button
                variant="success"
                onClick={async () => {
                  await timer.finish(notes || session.notes)
                  setNotes('')
                }}
              >
                <Check />
                Finish &amp; save
              </Button>
              <Button
                variant="ghost"
                className="text-[#C2545F]"
                onClick={() => void timer.discard()}
                title="Discard this session without saving"
              >
                <X />
                Discard
              </Button>
            </div>
            <p className="text-[0.68rem] text-[var(--fg-subtle)]">
              Elapsed time is recomputed from saved timestamps, so a refresh or a closed tab never
              changes the total.
            </p>
          </>
        )}

        {manualOpen && !session ? (
          <div className="space-y-2 rounded-2xl border border-[var(--line)] p-3">
            <p className="text-xs font-semibold">Log a session you already finished</p>
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Minutes studied" className="w-32">
                <Input
                  type="number"
                  min={1}
                  max={1440}
                  value={manualMinutes}
                  onChange={(event) => setManualMinutes(event.target.value)}
                  placeholder="45"
                />
              </Field>
              <Button
                disabled={!manualMinutes || Number(manualMinutes) <= 0}
                onClick={async () => {
                  await timer.start({ subjectId: subjectId || null, eventId, projectTaskId, taskId })
                  await timer.finish('Manually logged', Number(manualMinutes))
                  setManualMinutes('')
                  setManualOpen(false)
                }}
              >
                Save {manualMinutes ? formatMinutes(Number(manualMinutes)) : 'session'}
              </Button>
            </div>
          </div>
        ) : null}

        {session && session.focusedSeconds > 0 ? (
          <p className="text-[0.68rem] text-[var(--fg-subtle)]">
            Tracked so far: {formatSeconds(session.focusedSeconds)}
          </p>
        ) : null}
      </CardBody>
    </Card>
  )
}
