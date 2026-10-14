import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { CuteEmptyState } from '@/components/ui'
import { formatMinutes } from '@/lib/utils'

export interface BreakdownSlice {
  key: string
  label: string
  minutes: number
  color: string
}

export function CategoryBreakdown({
  data,
  title = 'Time by category',
  emptyTitle = 'Nothing tracked yet',
  emptyDescription = 'Completed activities will break down by category here.',
  height = 220,
}: {
  data: BreakdownSlice[]
  title?: string
  emptyTitle?: string
  emptyDescription?: string
  height?: number
}) {
  const filtered = data.filter((slice) => slice.minutes > 0)
  const total = filtered.reduce((sum, slice) => sum + slice.minutes, 0)

  if (filtered.length === 0) {
    return (
      <CuteEmptyState
        size="sm"
        mascot="bunny"
        title={emptyTitle}
        description={emptyDescription}
      />
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={filtered}
              dataKey="minutes"
              nameKey="label"
              innerRadius="58%"
              outerRadius="86%"
              paddingAngle={3}
              stroke="var(--surface)"
              strokeWidth={2}
            >
              {filtered.map((slice) => (
                <Cell key={slice.key} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 14,
                border: '1px solid var(--line)',
                background: 'var(--surface)',
                fontSize: 12,
              }}
              formatter={(value, name) => [
                formatMinutes(typeof value === 'number' ? value : Number(value)),
                String(name ?? ''),
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="font-display text-base leading-none font-bold">{formatMinutes(total, { compact: true })}</p>
            <p className="text-[0.6rem] tracking-wide text-[var(--fg-subtle)] uppercase">{title}</p>
          </div>
        </div>
      </div>

      <ul className="w-full min-w-0 space-y-1.5">
        {filtered
          .slice()
          .sort((a, b) => b.minutes - a.minutes)
          .map((slice) => (
            <li key={slice.key} className="flex items-center gap-2 text-xs">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: slice.color }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate text-[var(--fg-muted)]">{slice.label}</span>
              <span className="font-semibold text-[var(--fg)]">{formatMinutes(slice.minutes)}</span>
              <span className="w-9 text-right text-[0.65rem] text-[var(--fg-subtle)]">
                {total === 0 ? 0 : Math.round((slice.minutes / total) * 100)}%
              </span>
            </li>
          ))}
      </ul>
    </div>
  )
}
