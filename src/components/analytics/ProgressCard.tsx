import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { Card } from '@/components/ui'
import { Progress } from '@/components/ui'
import { cn } from '@/lib/utils'

export interface ProgressCardProps {
  title: string
  /** Big value, already formatted. */
  value: string
  /** Small caption under the value. */
  caption?: string
  icon?: ReactNode
  /** 0-100 for the progress bar; omit to hide it. */
  progress?: number
  /** Percentage change versus the previous period; omit when unknown. */
  delta?: number | null
  tone?: 'accent' | 'study' | 'project' | 'sleep' | 'habit'
  className?: string
  /** Shown instead of the value when there is genuinely no data yet. */
  empty?: boolean
  emptyText?: string
  action?: ReactNode
}

const TONES = {
  accent: 'bg-[var(--accent-soft)] text-[var(--accent-ink)]',
  study: 'bg-[var(--c-study)] text-[var(--c-study-ink)]',
  project: 'bg-[var(--c-project)] text-[var(--c-project-ink)]',
  sleep: 'bg-[var(--c-sleep)] text-[var(--c-sleep-ink)]',
  habit: 'bg-[var(--c-meal)] text-[var(--c-meal-ink)]',
} as const

export function ProgressCard({
  title,
  value,
  caption,
  icon,
  progress,
  delta,
  tone = 'accent',
  className,
  empty,
  emptyText = 'No records yet',
  action,
}: ProgressCardProps) {
  return (
    <Card className={cn('flex flex-col gap-3 p-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          {icon ? (
            <span className={cn('grid size-9 place-items-center rounded-xl [&_svg]:size-4', TONES[tone])}>
              {icon}
            </span>
          ) : null}
          <p className="text-xs font-semibold tracking-wide text-[var(--fg-muted)]">{title}</p>
        </div>
        {action}
      </div>

      {empty ? (
        <p className="text-sm text-[var(--fg-subtle)]">{emptyText}</p>
      ) : (
        <div className="flex items-end gap-2">
          <p className="font-display text-2xl leading-none font-bold text-[var(--fg)]">{value}</p>
          {delta !== undefined && delta !== null ? (
            <span
              className={cn(
                'mb-0.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.62rem] font-bold',
                delta > 0
                  ? 'bg-[var(--color-mint)] text-[var(--color-mint-deep)]'
                  : delta < 0
                    ? 'bg-[var(--color-blush)] text-[var(--color-rose-deep)]'
                    : 'bg-[var(--surface-3)] text-[var(--fg-muted)]',
              )}
            >
              {delta > 0 ? (
                <ArrowUpRight className="size-3" />
              ) : delta < 0 ? (
                <ArrowDownRight className="size-3" />
              ) : (
                <Minus className="size-3" />
              )}
              {Math.abs(Math.round(delta))}%
            </span>
          ) : null}
        </div>
      )}

      {caption ? <p className="-mt-1.5 text-[0.68rem] text-[var(--fg-subtle)]">{caption}</p> : null}

      {progress !== undefined && !empty ? (
        <Progress value={Math.min(100, Math.max(0, progress))} size="sm" />
      ) : null}
    </Card>
  )
}
