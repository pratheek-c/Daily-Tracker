import { useMemo } from 'react'
import { CalendarDays } from 'lucide-react'
import { Button, Card, CardBody, CardHeader, Chip } from '@/components/ui'
import { CATEGORY_META } from '@/config/categories'
import { WEEKDAY_LABELS, formatClock, isKeyToday } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { DateKey, Weekday } from '@/types'
import type { Occurrence } from '@/services/scheduling/recurrence'

/** Rows rendered when the grid is collapsed on small screens. */
const COMPACT_ROWS = 9
const EXPANDED_ROWS = 20

export interface WeekGridProps {
  days: DateKey[]
  occurrences: Occurrence[]
  weekStartsOn: Weekday
  timeFormat: '12h' | '24h'
  onSelectDay: (date: DateKey) => void
  onSelectOccurrence: (occurrence: Occurrence) => void
  onAddAt?: (date: DateKey) => void
  className?: string
}

/**
 * Week-at-a-glance grid.
 *
 * Instead of drawing minute-accurate geometry (which breaks down on phones) each
 * day is a compact ordered column of pastel blocks annotated with their time
 * range — readable at every size and still a true timetable.
 */
export function WeekGrid({
  days,
  occurrences,
  timeFormat,
  onSelectDay,
  onSelectOccurrence,
  onAddAt,
  className,
}: WeekGridProps) {
  const byDay = useMemo(() => {
    const map = new Map<DateKey, Occurrence[]>()
    for (const day of days) map.set(day, [])
    for (const occurrence of occurrences) {
      const list = map.get(occurrence.date)
      if (list) list.push(occurrence)
    }
    for (const list of map.values()) list.sort((a, b) => a.startMillis - b.startMillis)
    return map
  }, [days, occurrences])

  const maxItems = useMemo(
    () => Math.min(EXPANDED_ROWS, Math.max(COMPACT_ROWS, ...Array.from(byDay.values(), (list) => list.length))),
    [byDay],
  )

  const formatTime = (time: string) => formatClock(time as never, { timeFormat })

  return (
    <Card className={className}>
      <CardHeader
        title="Weekly timetable"
        description={`${days[0]} → ${days[days.length - 1]} · ${Array.from(byDay.values()).flat().length} blocks`}
        icon={<CalendarDays />}
        flush
      />
      <CardBody className="px-0 sm:px-0">
        <div className="overflow-x-auto">
          <div className="min-w-[860px] px-4 sm:px-5">
            {/* Header row */}
            <div className="grid grid-cols-[3.4rem_repeat(7,minmax(0,1fr))] gap-1.5 border-b border-[var(--line)] pb-2">
              <span className="text-[0.6rem] font-bold tracking-wider text-[var(--fg-subtle)] uppercase">
                #
              </span>
              {days.map((day) => {
                const weekday = new Date(`${day}T00:00:00`).getDay() as Weekday
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => onSelectDay(day)}
                    className={cn(
                      'rounded-xl px-1 py-1.5 text-center transition-colors hover:bg-[var(--surface-3)]',
                      isKeyToday(day) && 'bg-[var(--accent-soft)]',
                    )}
                  >
                    <span className="block text-[0.62rem] font-bold tracking-wide text-[var(--fg-subtle)] uppercase">
                      {WEEKDAY_LABELS[weekday]}
                    </span>
                    <span
                      className={cn(
                        'font-display block text-sm font-bold',
                        isKeyToday(day) ? 'text-[var(--accent-ink)]' : 'text-[var(--fg)]',
                      )}
                    >
                      {Number(day.slice(8, 10))}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Slot rows */}
            {Array.from({ length: maxItems }).map((_, rowIndex) => (
              <div
                key={rowIndex}
                className="grid grid-cols-[3.4rem_repeat(7,minmax(0,1fr))] gap-1.5 border-b border-[var(--line)] py-1 last:border-b-0"
              >
                <span className="pt-1 text-center text-[0.6rem] text-[var(--fg-subtle)]">
                  {rowIndex + 1}
                </span>
                {days.map((day) => {
                  const list = byDay.get(day) ?? []
                  const occurrence = list[rowIndex]
                  if (!occurrence) {
                    return (
                      <button
                        key={`${day}-empty-${rowIndex}`}
                        type="button"
                        onClick={() => onAddAt?.(day)}
                        aria-label={`Add a block on ${day} slot ${rowIndex + 1}`}
                        className="min-h-8 rounded-lg bg-[var(--surface-2)] transition-colors hover:bg-[var(--accent-soft)]"
                      />
                    )
                  }
                  const meta = CATEGORY_META[occurrence.event.category]
                  return (
                    <button
                      key={`${occurrence.event.id}-${occurrence.date}`}
                      type="button"
                      onClick={() => onSelectOccurrence(occurrence)}
                      style={meta.style}
                      className={cn(
                        'min-h-8 rounded-lg px-1.5 py-1 text-left transition-transform hover:-translate-y-px hover:shadow-[0_8px_18px_-14px_rgb(55_49_61_/_0.6)]',
                        occurrence.event.status === 'completed' && 'opacity-70',
                      )}
                      title={`${occurrence.event.title} · ${formatTime(occurrence.startTime)}–${formatTime(occurrence.endTime)}`}
                    >
                      <span className="block truncate text-[0.62rem] font-bold">
                        {formatTime(occurrence.startTime)}
                      </span>
                      <span className="block truncate text-[0.66rem] leading-tight font-semibold">
                        {occurrence.event.title}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3 sm:px-5">
          {Object.values(CATEGORY_META).map((meta) => (
            <Chip key={meta.value} style={meta.style}>
              {meta.label}
            </Chip>
          ))}
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={() => onSelectDay(days[0])}
          >
            Open day view
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
