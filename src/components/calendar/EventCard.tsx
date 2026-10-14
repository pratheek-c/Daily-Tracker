import { Check, Clock, MapPin, MoreVertical, Pause, Pencil, Play, Tag, TriangleAlert, Video, X } from 'lucide-react'
import { Button, Chip, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui'
import { CATEGORY_META, PRIORITY_META } from '@/config/categories'
import { ACTIVITY_STATUS_META } from '@/config/categories'
import { cn } from '@/lib/utils'
import type { Occurrence } from '@/services/scheduling/recurrence'
import type { TimeKey } from '@/types'

export interface EventCardProps {
  occurrence: Occurrence
  /** Formats a wall-clock time for display. */
  formatTime: (time: TimeKey) => string
  conflicts?: number
  compact?: boolean
  className?: string
  onRun?: () => void
  onPause?: () => void
  onComplete?: () => void
  onMissed?: () => void
  onCancel?: () => void
  onEdit?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
  onStartStudy?: () => void
  readOnly?: boolean
}

export function EventCard({
  occurrence,
  formatTime,
  conflicts = 0,
  compact,
  className,
  onRun,
  onPause,
  onComplete,
  onMissed,
  onCancel,
  onEdit,
  onDuplicate,
  onDelete,
  onStartStudy,
  readOnly,
}: EventCardProps) {
  const { event } = occurrence
  const meta = CATEGORY_META[event.category]
  const priority = PRIORITY_META[event.priority]
  const status = ACTIVITY_STATUS_META[event.status]
  const Icon = meta.icon
  const inProgress = event.status === 'in-progress'
  const done = event.status === 'completed'
  const isSleep = event.category === 'sleep'
  const isGenerated = event.seriesId === 'sleep-schedule' || event.seriesId === 'winddown-schedule'

  return (
    <div
      className={cn(
        'group relative flex gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 transition-shadow hover:shadow-[0_10px_28px_-20px_rgb(55_49_61_/_0.45)]',
        inProgress && 'ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--surface)]',
        done && 'opacity-75',
        event.status === 'cancelled' && 'opacity-55',
        className,
      )}
    >
      {/* Pastel time gutter */}
      <div
        className="flex w-[4.4rem] shrink-0 flex-col items-center justify-center rounded-xl px-1 py-1.5 text-center"
        style={meta.style}
      >
        <span className="text-[0.72rem] leading-tight font-bold">{formatTime(occurrence.startTime)}</span>
        <span className="my-0.5 h-px w-5 bg-current opacity-30" />
        <span className="text-[0.66rem] leading-tight opacity-80">{formatTime(occurrence.endTime)}</span>
        <span className="mt-1 text-[0.58rem] tracking-wide opacity-70 uppercase">
          {occurrence.durationMinutes}m
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <Icon className="mt-0.5 size-3.5 shrink-0 text-[var(--fg-subtle)]" />
          <p
            className={cn(
              'min-w-0 flex-1 text-sm leading-snug font-semibold text-[var(--fg)]',
              event.status === 'cancelled' && 'line-through',
            )}
          >
            {event.title}
          </p>
          {!readOnly ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={`Actions for ${event.title}`}
                >
                  <MoreVertical />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onRun && event.status !== 'in-progress' && !done ? (
                  <DropdownMenuItem onSelect={onRun}>
                    <Play />
                    Start now
                  </DropdownMenuItem>
                ) : null}
                {onPause && inProgress ? (
                  <DropdownMenuItem onSelect={onPause}>
                    <Pause />
                    Pause tracking
                  </DropdownMenuItem>
                ) : null}
                {onComplete && !done ? (
                  <DropdownMenuItem onSelect={onComplete}>
                    <Check />
                    Mark completed
                  </DropdownMenuItem>
                ) : null}
                {onMissed && !done ? (
                  <DropdownMenuItem onSelect={onMissed}>
                    <X />
                    Mark missed
                  </DropdownMenuItem>
                ) : null}
                {onStartStudy && (event.category === 'study' || event.category === 'project') ? (
                  <DropdownMenuItem onSelect={onStartStudy}>
                    <Clock />
                    Track study time
                  </DropdownMenuItem>
                ) : null}
                {onEdit ? (
                  <DropdownMenuItem onSelect={onEdit}>
                    <Pencil />
                    Edit
                  </DropdownMenuItem>
                ) : null}
                {onDuplicate ? (
                  <DropdownMenuItem onSelect={onDuplicate}>
                    <Tag />
                    Duplicate
                  </DropdownMenuItem>
                ) : null}
                {onCancel && !isGenerated ? (
                  <DropdownMenuItem onSelect={onCancel}>
                    <X />
                    {event.seriesId ? 'Cancel this day' : 'Delete'}
                  </DropdownMenuItem>
                ) : null}
                {onDelete ? (
                  <DropdownMenuItem onSelect={onDelete} className="text-[#C2545F]">
                    <X />
                    Delete
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {!compact ? (
          <>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Chip style={meta.style}>{meta.label}</Chip>
              <Chip className={priority.chip.replace('border-transparent', '')}>
                {priority.label}
              </Chip>
              {event.status !== 'planned' ? <Chip className={status.chip}>{status.label}</Chip> : null}
              {event.recurrence || isGenerated ? (
                <Chip tone="neutral">↻ Repeats</Chip>
              ) : null}
              {occurrence.overnight ? <Chip tone="neutral">Crosses midnight</Chip> : null}
              {conflicts > 0 ? (
                <Chip tone="warning" icon={<TriangleAlert />}>
                  {conflicts} overlap{conflicts === 1 ? '' : 's'}
                </Chip>
              ) : null}
              {event.actualMinutes !== null ? (
                <Chip tone="success">Actual {event.actualMinutes}m</Chip>
              ) : null}
            </div>

            {event.description ? (
              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[var(--fg-muted)]">
                {event.description}
              </p>
            ) : null}

            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[0.68rem] text-[var(--fg-subtle)]">
              {event.location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3" />
                  {event.location}
                </span>
              ) : null}
              {event.meetingUrl ? (
                <a
                  href={event.meetingUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-[var(--accent-ink)] hover:underline"
                >
                  <Video className="size-3" />
                  Join
                </a>
              ) : null}
            </div>
          </>
        ) : null}

        {!readOnly && !compact ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {!done && onRun ? (
              <Button size="sm" variant="soft" onClick={onRun}>
                <Play />
                {inProgress ? 'Restart' : 'Start'}
              </Button>
            ) : null}
            {onPause && inProgress ? (
              <Button size="sm" variant="outline" onClick={onPause}>
                <Pause />
                Pause
              </Button>
            ) : null}
            {!done && onComplete ? (
              <Button size="sm" variant="success" onClick={onComplete}>
                <Check />
                Done
              </Button>
            ) : null}
            {!isSleep && !isGenerated && onEdit ? (
              <Button size="sm" variant="ghost" onClick={onEdit}>
                <Pencil />
                Edit
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
