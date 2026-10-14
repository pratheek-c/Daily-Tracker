import * as SwitchPrimitive from '@radix-ui/react-switch'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import * as ProgressPrimitive from '@radix-ui/react-progress'
import { Check, Minus } from 'lucide-react'
import type { ComponentProps, HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/* -- Switch ---------------------------------------------------------------- */

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-5.5 w-9.5 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors',
        'data-[state=checked]:bg-[var(--accent)] data-[state=unchecked]:bg-[var(--line-strong)]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-4.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[1.15rem] data-[state=unchecked]:translate-x-0.5" />
    </SwitchPrimitive.Root>
  )
}

/* -- Checkbox -------------------------------------------------------------- */

export function Checkbox({
  className,
  indeterminate,
  ...props
}: ComponentProps<typeof CheckboxPrimitive.Root> & { indeterminate?: boolean }) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'peer size-4.5 shrink-0 cursor-pointer rounded-md border border-[var(--line-strong)] bg-[var(--surface)] transition-colors',
        'data-[state=checked]:border-[var(--accent)] data-[state=checked]:bg-[var(--accent)] data-[state=checked]:text-white',
        'hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="grid place-items-center text-current">
        {indeterminate ? <Minus className="size-3" /> : <Check className="size-3" strokeWidth={3} />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

/* -- Progress -------------------------------------------------------------- */

export interface ProgressProps {
  value: number
  max?: number
  className?: string
  barClassName?: string
  label?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function Progress({
  value,
  max = 100,
  className,
  barClassName,
  label,
  size = 'md',
}: ProgressProps) {
  const safeMax = max <= 0 ? 100 : max
  const clamped = Math.min(Math.max(value, 0), safeMax)
  const pct = (clamped / safeMax) * 100
  const heights = { sm: 'h-1.5', md: 'h-2', lg: 'h-3' } as const

  return (
    <div className={cn('w-full', className)}>
      {label ? (
        <div className="mb-1 flex items-center justify-between text-xs text-[var(--fg-muted)]">
          {label}
          <span className="font-semibold text-[var(--fg)]">{Math.round(pct)}%</span>
        </div>
      ) : null}
      <ProgressPrimitive.Root
        value={clamped}
        max={safeMax}
        className={cn(
          'relative w-full overflow-hidden rounded-full bg-[var(--surface-3)]',
          heights[size],
        )}
      >
        <ProgressPrimitive.Indicator
          className={cn(
            'h-full rounded-full bg-[var(--accent)] transition-[width] duration-500 ease-out',
            barClassName,
          )}
          style={{ width: `${pct}%` }}
        />
      </ProgressPrimitive.Root>
    </div>
  )
}

/* -- Chip ------------------------------------------------------------------ */

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'sleep'
  icon?: ReactNode
}

export function Chip({ className, tone = 'neutral', icon, children, ...props }: ChipProps) {
  const tones = {
    neutral: 'bg-[var(--surface-3)] text-[var(--fg-muted)]',
    accent: 'bg-[var(--accent-soft)] text-[var(--accent-ink)]',
    success: 'bg-[var(--color-mint)] text-[var(--color-mint-deep)]',
    warning: 'bg-[var(--color-peach)] text-[var(--color-peach-deep)]',
    danger: 'bg-[var(--color-blush)] text-[var(--color-rose-deep)]',
    sleep: 'bg-[var(--c-sleep)] text-[var(--c-sleep-ink)]',
  } as const

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.68rem] font-semibold whitespace-nowrap',
        '[&_svg]:size-3',
        tones[tone],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  )
}

/* -- Separator ------------------------------------------------------------- */

export function Separator({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div role="separator" className={cn('h-px w-full bg-[var(--line)]', className)} {...props} />
}
