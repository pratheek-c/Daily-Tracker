import { Pause, Play, RotateCcw, Settings2, SkipForward } from 'lucide-react'
import { Button, Card, CardBody, CardHeader, Chip } from '@/components/ui'
import { Mascot } from '@/components/ui'
import { usePomodoro } from '@/hooks/useTimers'
import { formatSeconds } from '@/lib/utils'
import { cn } from '@/lib/utils'

export interface PomodoroTimerProps {
  className?: string
  compact?: boolean
}

/** Focus timer driven entirely by the persisted timer snapshot. */
export function PomodoroTimer({ className, compact }: PomodoroTimerProps) {
  const timer = usePomodoro()

  const circumference = 2 * Math.PI * 52
  const dash = circumference * timer.progress

  return (
    <Card className={className}>
      <CardHeader
        title="Focus timer"
        description={`${timer.cycle} focus block${timer.cycle === 1 ? '' : 's'} completed today`}
        icon={<Mascot kind="cat" className="size-4" />}
        action={
          <Chip tone={timer.running ? 'accent' : 'neutral'}>{timer.running ? 'Running' : 'Paused'}</Chip>
        }
      />
      <CardBody className={cn('flex flex-col items-center gap-3', compact && 'gap-2 py-3')}>
        <div className="relative">
          <svg viewBox="0 0 120 120" className={cn('size-36 -rotate-90', compact && 'size-28')}>
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--surface-3)" strokeWidth="9" />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference}`}
              className="transition-[stroke-dasharray] duration-700 ease-linear"
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <p className="font-display text-2xl leading-none font-bold tabular-nums">
                {formatSeconds(timer.remaining)}
              </p>
              <p className="mt-0.5 text-[0.65rem] tracking-wide text-[var(--fg-subtle)] uppercase">
                {timer.label}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {timer.running ? (
            <Button size="sm" variant="outline" onClick={timer.pause}>
              <Pause />
              Pause
            </Button>
          ) : (
            <Button size="sm" onClick={timer.start}>
              <Play />
              {timer.mode === 'idle' ? 'Start focus' : 'Resume'}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={timer.skip} title="Skip to next segment">
            <SkipForward />
            Skip
          </Button>
          <Button size="sm" variant="ghost" onClick={timer.reset} title="Reset the timer">
            <RotateCcw />
            Reset
          </Button>
        </div>

        {!compact ? (
          <div className="flex flex-wrap justify-center gap-1.5">
            {(
              [
                { id: 'focus', label: 'Focus' },
                { id: 'short-break', label: 'Short break' },
                { id: 'long-break', label: 'Long break' },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => timer.setMode(option.id)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold transition-colors',
                  timer.mode === option.id
                    ? 'border-transparent bg-[var(--accent-soft)] text-[var(--accent-ink)]'
                    : 'border-[var(--line-strong)] text-[var(--fg-muted)] hover:border-[var(--accent)]',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}

        <p className="flex items-center gap-1 text-center text-[0.65rem] text-[var(--fg-subtle)]">
          <Settings2 className="size-3" />
          Durations are configurable in Settings. Focus time is logged to your study records.
        </p>
      </CardBody>
    </Card>
  )
}
