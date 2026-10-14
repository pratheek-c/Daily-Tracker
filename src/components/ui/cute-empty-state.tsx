import type { ReactNode } from 'react'
import { Decoration, Mascot, type DecorationKind, type MascotKind } from '@/components/mascots/Mascot'
import { cn } from '@/lib/utils'

export interface CuteEmptyStateProps {
  mascot?: MascotKind
  title: string
  description?: string
  action?: ReactNode
  className?: string
  /** Compact variant for use inside a card. */
  size?: 'sm' | 'md' | 'lg'
  decoration?: DecorationKind
}

/**
 * The friendly fallback shown wherever there is genuinely no data yet.
 *
 * It never invents numbers — it explains what to do next instead.
 */
export function CuteEmptyState({
  mascot = 'bunny',
  title,
  description,
  action,
  className,
  size = 'md',
  decoration = 'star',
}: CuteEmptyStateProps) {
  const mascotSize = { sm: 'size-16', md: 'size-24', lg: 'size-32' }[size]
  const titleSize = { sm: 'text-sm', md: 'text-base', lg: 'text-lg' }[size]

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center gap-2 rounded-2xl px-6 text-center',
        size === 'sm' ? 'py-6' : 'py-10',
        className,
      )}
    >
      <Decoration
        kind={decoration}
        className="absolute animate-twinkle text-[var(--color-warning)] opacity-70"
        style={{ top: '12%', left: '18%', width: 14, height: 14 }}
      />
      <Decoration
        kind="heart"
        className="absolute animate-twinkle text-[var(--accent)] opacity-50"
        style={{ top: '22%', right: '16%', width: 12, height: 12, animationDelay: '1.1s' }}
      />
      <Mascot kind={mascot} className={cn(mascotSize, 'animate-float')} />
      <h3 className={cn('font-display font-bold text-[var(--fg)]', titleSize)}>{title}</h3>
      {description ? (
        <p className="max-w-sm text-xs leading-relaxed text-[var(--fg-muted)]">{description}</p>
      ) : null}
      {action ? <div className="mt-1.5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  )
}
