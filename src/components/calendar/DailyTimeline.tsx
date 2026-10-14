import { useMemo } from 'react'
import { CalendarPlus, Moon } from 'lucide-react'
import { Button, Card, CardBody, CardHeader, CuteEmptyState } from '@/components/ui'
import { EventCard } from './EventCard'
import { CATEGORY_META } from '@/config/categories'
import { cn } from '@/lib/utils'
import { formatClock, relativeDayLabel } from '@/lib/date'
import type { DateKey } from '@/types'
import type { Occurrence } from '@/services/scheduling/recurrence'
import type { Conflict } from '@/services/scheduling/recurrence'

export interface DailyTimelineProps {
  date: DateKey
  occurrences: Occurrence[]
  conflicts?: Conflict[]
  timeFormat: '12h' | '24h'
  title?: string
  description?: string
  onAdd?: () => void
  onEdit?: (occurrence: Occurrence) => void
  onRun?: (occurrence: Occurrence) => void
  onPause?: (occurrence: Occurrence) => void
  onComplete?: (occurrence: Occurrence) => void
  onMissed?: (occurrence: Occurrence) => void
  onCancelOccurrence?: (occurrence: Occurrence) => void
  onDuplicate?: (occurrence: Occurrence) => void
  onStartStudy?: (occurrence: Occurrence) => void
  now: number
  showDateLabel?: boolean
  className?: string
  /** Highlight the current time with a marker between blocks. */
  showNowIndicator?: boolean
}

/**
 * The chronological day view used by the dashboard, planner and calendar.
 *
 * It renders real occurrences only, so an empty day shows a friendly prompt
 * rather than placeholder rows.
 */
export function DailyTimeline({
  date,
  occurrences,
  conflicts = [],
  timeFormat,
  title,
  description,
  onAdd,
  onEdit,
  onRun,
  onPause,
  onComplete,
  onMissed,
  onCancelOccurrence,
  onDuplicate,
  onStartStudy,
  now,
  showDateLabel,
  className,
  showNowIndicator = true,
}: DailyTimelineProps) {
  const dayOccurrences = useMemo(
    () => occurrences.filter((occurrence) => occurrence.date === date),
    [occurrences, date],
  )

  const conflictCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const conflict of conflicts) {
      for (const side of [conflict.a, conflict.b]) {
        const key = `${side.event.id}|${side.date}`
        map.set(key, (map.get(key) ?? 0) + 1)
      }
    }
    // A single pair counts once for each event, not twice.
    for (const [key, value] of map) map.set(key, Math.ceil(value / 2))
    return map
  }, [conflicts])

  const nowTime = new Date(now).toTimeString().slice(0, 5)
  const isToday = date === new Date(now).toISOString().slice(0, 10)

  const formatTime = (time: string) => formatClock(time as never, { timeFormat })

  return (
    <Card className={className}>
      {title ? (
        <CardHeader
          title={title}
          description={description}
          icon={<Moon />}
          action={
            onAdd ? (
              <Button size="sm" variant="soft" onClick={onAdd}>
                <CalendarPlus />
                Add block
              </Button>
            ) : null
          }
        />
      ) : null}
      <CardBody className={cn('space-y-2', !title && 'pt-4')}>
        {showDateLabel ? (
          <p className="text-xs font-semibold text-[var(--fg-muted)]">{relativeDayLabel(date)}</p>
        ) : null}

        {dayOccurrences.length === 0 ? (
          <CuteEmptyState
            mascot="cat-box"
            title="Nothing scheduled yet"
            description="Add a study block, a class or a wind-down routine and it will appear here in order."
            action={
              onAdd ? (
                <Button size="sm" onClick={onAdd}>
                  <CalendarPlus />
                  Add your first block
                </Button>
              ) : null
            }
          />
        ) : (
          dayOccurrences.map((occurrence, index) => {
            const key = `${occurrence.event.id}|${occurrence.date}`
            const showNow =
              showNowIndicator &&
              isToday &&
              nowTime >= occurrence.startTime &&
              nowTime < occurrence.endTime
            return (
              <div key={key}>
                {showNow ? (
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="size-2 animate-breathe rounded-full bg-[var(--accent)]" />
                    <span className="text-[0.62rem] font-bold tracking-wide text-[var(--accent-ink)] uppercase">
                      Now
                    </span>
                    <span className="h-px flex-1 bg-[var(--accent)] opacity-40" />
                  </div>
                ) : null}
                <EventCard
                  occurrence={occurrence}
                  formatTime={formatTime}
                  conflicts={conflictCounts.get(key) ?? 0}
                  onRun={onRun ? () => onRun(occurrence) : undefined}
                  onPause={onPause ? () => onPause(occurrence) : undefined}
                  onComplete={onComplete ? () => onComplete(occurrence) : undefined}
                  onMissed={onMissed ? () => onMissed(occurrence) : undefined}
                  onEdit={onEdit ? () => onEdit(occurrence) : undefined}
                  onCancel={onCancelOccurrence ? () => onCancelOccurrence(occurrence) : undefined}
                  onDuplicate={onDuplicate ? () => onDuplicate(occurrence) : undefined}
                  onStartStudy={onStartStudy ? () => onStartStudy(occurrence) : undefined}
                />
                {index < dayOccurrences.length - 1 &&
                dayOccurrences[index + 1].startMillis - occurrence.endMillis > 45 * 60_000 ? (
                  <p className="py-1 text-center text-[0.62rem] text-[var(--fg-subtle)]">
                    free until {formatTime(dayOccurrences[index + 1].startTime)}
                  </p>
                ) : null}
              </div>
            )
          })
        )}

        {dayOccurrences.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 border-t border-[var(--line)] pt-2.5">
            {Array.from(
              dayOccurrences.reduce((map, occurrence) => {
                const category = occurrence.event.category
                const minutes = occurrence.durationMinutes
                map.set(category, (map.get(category) ?? 0) + minutes)
                return map
              }, new Map<string, number>()),
            ).map(([category, minutes]) => {
              const meta = CATEGORY_META[category as keyof typeof CATEGORY_META]
              return (
                <span
                  key={category}
                  className="rounded-full px-2 py-0.5 text-[0.62rem] font-semibold"
                  style={meta.style}
                >
                  {meta.label} {Math.round(minutes / 60)}h{minutes % 60 ? ` ${minutes % 60}m` : ''}
                </span>
              )
            })}
          </div>
        ) : null}
      </CardBody>
    </Card>
  )
}
