import { useMemo } from 'react'
import { CalendarDays } from 'lucide-react'
import { Chip, Input } from '@/components/ui'
import { addDaysToKey, todayKey } from '@/lib/date'
import { cn } from '@/lib/utils'

export interface RangePreset {
  id: string
  label: string
  from: string
  to: string
}

function buildPresets(today: string): RangePreset[] {
  // Week starts on Monday to match the default planner setting.
  const day = new Date(`${today}T00:00:00`).getDay()
  const mondayOffset = (day + 6) % 7
  const weekStart = addDaysToKey(today, -mondayOffset)
  const monthStart = `${today.slice(0, 7)}-01`
  return [
    { id: 'today', label: 'Today', from: today, to: today },
    { id: 'week', label: 'This week', from: weekStart, to: addDaysToKey(weekStart, 6) },
    {
      id: 'last-week',
      label: 'Last week',
      from: addDaysToKey(weekStart, -7),
      to: addDaysToKey(weekStart, -1),
    },
    { id: 'month', label: 'This month', from: monthStart, to: today },
    { id: '30', label: 'Last 30 days', from: addDaysToKey(today, -29), to: today },
    { id: '90', label: 'Last 90 days', from: addDaysToKey(today, -89), to: today },
  ]
}

export function RangePicker({
  from,
  to,
  onChange,
  className,
}: {
  from: string
  to: string
  onChange: (next: { from: string; to: string }) => void
  className?: string
}) {
  const presets = useMemo(() => buildPresets(todayKey()), [])
  const activePreset = presets.find((preset) => preset.from === from && preset.to === to)
  const invalid = from > to

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange({ from: preset.from, to: preset.to })}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold transition-colors',
              activePreset?.id === preset.id
                ? 'border-transparent bg-[var(--accent-soft)] text-[var(--accent-ink)]'
                : 'border-[var(--line-strong)] text-[var(--fg-muted)] hover:border-[var(--accent)]',
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <CalendarDays className="size-3.5 text-[var(--fg-subtle)]" />
        <Input
          type="date"
          value={from}
          max={to}
          onChange={(event) => onChange({ from: event.target.value, to })}
          className="h-8 w-[8.6rem] px-2 text-xs"
          aria-label="Range start"
        />
        <span className="text-xs text-[var(--fg-subtle)]">→</span>
        <Input
          type="date"
          value={to}
          min={from}
          onChange={(event) => onChange({ from, to: event.target.value })}
          className="h-8 w-[8.6rem] px-2 text-xs"
          aria-label="Range end"
        />
      </div>
      {invalid ? <Chip tone="danger">Start date is after the end date</Chip> : null}
    </div>
  )
}
