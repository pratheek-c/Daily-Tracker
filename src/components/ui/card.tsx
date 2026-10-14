import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-[var(--line)] bg-[var(--surface)]',
        'shadow-[0_1px_3px_rgb(55_49_61_/_0.04),0_18px_40px_-32px_rgb(117_97_168_/_0.35)]',
        className,
      )}
      {...props}
    />
  )
}

export interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  /** Removes the bottom padding when the body manages its own spacing. */
  flush?: boolean
}

export function CardHeader({
  title,
  description,
  icon,
  action,
  flush,
  className,
  ...props
}: CardHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5',
        flush ? 'pb-0' : 'pb-3',
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-ink)] [&_svg]:size-4">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h3 className="truncate text-[0.95rem] leading-tight font-bold text-[var(--fg)]">
            {title}
          </h3>
          {description ? (
            <p className="mt-0.5 text-xs text-[var(--fg-muted)]">{description}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-1.5">{action}</div> : null}
    </div>
  )
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 py-4 sm:px-5', className)} {...props} />
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 border-t border-[var(--line)] px-4 py-3 sm:px-5',
        className,
      )}
      {...props}
    />
  )
}
