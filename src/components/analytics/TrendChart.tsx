import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CuteEmptyState } from '@/components/ui'
import { cn } from '@/lib/utils'

export interface TrendSeries {
  key: string
  label: string
  color: string
  type?: 'area' | 'line' | 'bar'
  dashed?: boolean
}

export interface TrendChartProps {
  data: Record<string, unknown>[]
  xKey: string
  series: TrendSeries[]
  chart?: 'area' | 'line' | 'bar'
  height?: number
  className?: string
  valueFormatter?: (value: number) => string
  tooltipLabelFormatter?: (value: unknown, payload: Record<string, unknown>) => string
  emptyTitle?: string
  emptyDescription?: string
  /** Y-axis unit suffix, e.g. "h" or "min". */
  yUnit?: string
}

/**
 * One responsive chart wrapper for every trend in the app.
 *
 * Recharts renders from the data it is given, so charts update automatically
 * whenever the underlying records change and can never drift from the database.
 */
export function TrendChart({
  data,
  xKey,
  series,
  chart = 'area',
  height = 240,
  className,
  valueFormatter,
  tooltipLabelFormatter,
  emptyTitle = 'No data in this range',
  emptyDescription = 'Record a few days and the trend will appear here.',
  yUnit,
}: TrendChartProps) {
  const hasData = data.length > 0 && series.length > 0

  if (!hasData) {
    return (
      <div className={cn('grid place-items-center', className)} style={{ minHeight: height * 0.7 }}>
        <CuteEmptyState size="sm" mascot="cat" title={emptyTitle} description={emptyDescription} />
      </div>
    )
  }

  const tooltip = (
    <Tooltip
      cursor={{ stroke: 'var(--line-strong)', strokeWidth: 1 }}
      contentStyle={{
        borderRadius: 14,
        border: '1px solid var(--line)',
        background: 'var(--surface)',
        boxShadow: '0 16px 40px -24px rgb(55 49 61 / 0.4)',
        fontSize: 12,
        color: 'var(--fg)',
      }}
      labelStyle={{ fontWeight: 700, color: 'var(--fg)', marginBottom: 2 }}
      formatter={(value, name) => {
        const numeric = typeof value === 'number' ? value : Number(value)
        return [
          valueFormatter ? valueFormatter(numeric) : String(value ?? ''),
          String(name ?? ''),
        ]
      }}
      labelFormatter={(label, payload) => {
        const row = (payload?.[0]?.payload ?? {}) as Record<string, unknown>
        return tooltipLabelFormatter ? tooltipLabelFormatter(label, row) : String(label ?? '')
      }}
    />
  )

  const axes = (
    <>
      <CartesianGrid stroke="var(--line)" strokeDasharray="3 4" vertical={false} />
      <XAxis
        dataKey={xKey}
        tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }}
        axisLine={{ stroke: 'var(--line)' }}
        tickLine={false}
        interval="preserveStartEnd"
        minTickGap={12}
      />
      <YAxis
        tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }}
        axisLine={false}
        tickLine={false}
        width={38}
        unit={yUnit}
      />
    </>
  )

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {chart === 'bar' ? (
          <BarChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
            {axes}
            {tooltip}
            {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 11 }} /> : null}
            {series.map((entry) => (
              <Bar
                key={entry.key}
                dataKey={entry.key}
                name={entry.key}
                fill={entry.color}
                radius={[6, 6, 0, 0]}
                maxBarSize={38}
              />
            ))}
          </BarChart>
        ) : chart === 'line' ? (
          <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
            {axes}
            {tooltip}
            {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 11 }} /> : null}
            {series.map((entry) => (
              <Line
                key={entry.key}
                type="monotone"
                dataKey={entry.key}
                name={entry.key}
                stroke={entry.color}
                strokeWidth={2.2}
                strokeDasharray={entry.dashed ? '5 4' : undefined}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls
              />
            ))}
          </LineChart>
        ) : (
          <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
            <defs>
              {series.map((entry) => (
                <linearGradient key={entry.key} id={`grad-${entry.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={entry.color} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={entry.color} stopOpacity={0.04} />
                </linearGradient>
              ))}
            </defs>
            {axes}
            {tooltip}
            {series.length > 1 ? <Legend wrapperStyle={{ fontSize: 11 }} /> : null}
            {series.map((entry) => (
              <Area
                key={entry.key}
                type="monotone"
                dataKey={entry.key}
                name={entry.key}
                stroke={entry.color}
                strokeWidth={2.2}
                strokeDasharray={entry.dashed ? '5 4' : undefined}
                fill={`url(#grad-${entry.key})`}
                connectNulls
              />
            ))}
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
