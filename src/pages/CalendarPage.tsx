import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  List,
} from 'lucide-react'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'
import { EventFormDialog } from '@/components/calendar/EventFormDialog'
import { DailyTimeline } from '@/components/calendar/DailyTimeline'
import { WeekGrid } from '@/components/timetable/WeekGrid'
import { useApp } from '@/app/AppContext'
import { useWindowContext } from '@/hooks/useWindowContext'
import { CATEGORY_META } from '@/config/categories'
import {
  addDaysToKey,
  formatClock,
  formatDayLabel,
  formatMonthYear,
  isKeyToday,
  monthGridKeys,
  relativeDayLabel,
  todayKey,
  weekKeys,
  weekStartKey,
  WEEKDAY_LABELS,
} from '@/lib/date'
import { cn } from '@/lib/utils'
import { buildIcs, downloadIcs } from '@/services/export/ics'
import type { Occurrence } from '@/services/scheduling/recurrence'
import type { DateKey } from '@/types'

type CalendarView = 'day' | 'week' | 'month' | 'agenda'

export default function CalendarPage() {
  const navigate = useNavigate()
  const { data, settings, now, startActivity, finishActivity, deleteOccurrence } = useApp()
  const [view, setView] = useState<CalendarView>('month')
  const [anchor, setAnchor] = useState<DateKey>(todayKey())
  const [formOpen, setFormOpen] = useState(false)
  const [formDate, setFormDate] = useState<DateKey>(todayKey())
  const [editing, setEditing] = useState<{ event: Occurrence['event']; date: string } | null>(null)

  // A wider window keeps every view (and month grid padding) fully covered.
  const windowFrom = useMemo(() => addDaysToKey(weekStartKey(anchor, settings.weekStartsOn), -7), [anchor, settings.weekStartsOn])
  const windowTo = useMemo(() => addDaysToKey(windowFrom, 70), [windowFrom])
  const window = useWindowContext(windowFrom, windowTo)

  const byDay = useMemo(() => {
    const map = new Map<DateKey, Occurrence[]>()
    for (const occurrence of window.occurrences) {
      const list = map.get(occurrence.date) ?? []
      list.push(occurrence)
      map.set(occurrence.date, list)
    }
    for (const list of map.values()) list.sort((a, b) => a.startMillis - b.startMillis)
    return map
  }, [window.occurrences])

  const week = useMemo(
    () => weekKeys(anchor, settings.weekStartsOn),
    [anchor, settings.weekStartsOn],
  )

  const monthDays = useMemo(
    () => monthGridKeys(anchor, settings.weekStartsOn),
    [anchor, settings.weekStartsOn],
  )

  const agendaDays = useMemo(() => {
    const days = Array.from(byDay.entries())
      .filter(([date, list]) => date >= anchor && list.length > 0)
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    return days.slice(0, 30)
  }, [byDay, anchor])

  const step = (direction: -1 | 1) => {
    if (view === 'day') setAnchor(addDaysToKey(anchor, direction))
    else if (view === 'week') setAnchor(addDaysToKey(anchor, direction * 7))
    else if (view === 'month') {
      const date = new Date(`${anchor}T00:00:00`)
      date.setMonth(date.getMonth() + direction)
      setAnchor(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`)
    } else setAnchor(addDaysToKey(anchor, direction * 14))
  }

  const headerLabel =
    view === 'day'
      ? formatDayLabel(anchor, { withYear: true })
      : view === 'week'
        ? `${formatDayLabel(week[0])} → ${formatDayLabel(week[6])}`
        : view === 'month'
          ? formatMonthYear(anchor)
          : `From ${formatDayLabel(anchor)}`

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-2">
        <div>
          <h1 className="font-display text-lg font-bold sm:text-xl">Calendar</h1>
          <p className="text-xs text-[var(--fg-muted)]">{headerLabel}</p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button variant="outline" size="icon" onClick={() => step(-1)} aria-label="Previous period">
            <ChevronLeft />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setAnchor(todayKey())}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => step(1)} aria-label="Next period">
            <ChevronRight />
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setFormDate(anchor)
              setFormOpen(true)
            }}
          >
            <CalendarPlus />
            Add event
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Series templates carry an RRULE, concrete blocks are exported as
              // single events, and cancel-markers are left out entirely.
              const exportable = data.events.filter(
                (event) =>
                  !event.isSeriesTemplate ||
                  (event.recurrence !== null && event.status !== 'cancelled'),
              )
              downloadIcs(`anusree-tracker-${todayKey()}.ics`, buildIcs(exportable))
            }}
            title="Export every scheduled block as an .ics file"
          >
            <Download />
            Export .ics
          </Button>
        </div>
      </header>

      <Tabs value={view} onValueChange={(value) => setView(value as CalendarView)}>
        <TabsList>
          <TabsTrigger value="day">
            <Clock />
            Day
          </TabsTrigger>
          <TabsTrigger value="week">
            <CalendarDays />
            Week
          </TabsTrigger>
          <TabsTrigger value="month">
            <CalendarDays />
            Month
          </TabsTrigger>
          <TabsTrigger value="agenda">
            <List />
            Agenda
          </TabsTrigger>
        </TabsList>

        <TabsContent value="day">
          <DailyTimeline
            date={anchor}
            occurrences={window.occurrences}
            conflicts={window.conflicts}
            timeFormat={settings.timeFormat}
            title={formatDayLabel(anchor, { withYear: true })}
            now={now}
            onAdd={() => {
              setFormDate(anchor)
              setFormOpen(true)
            }}
            onEdit={(occurrence) => setEditing({ event: occurrence.event, date: occurrence.date })}
            onRun={(occurrence) => void startActivity(occurrence.event, occurrence.date)}
            onComplete={(occurrence) =>
              void finishActivity(occurrence.event, occurrence.date, 'completed')
            }
            onMissed={(occurrence) => void finishActivity(occurrence.event, occurrence.date, 'missed')}
            onCancelOccurrence={(occurrence) => void deleteOccurrence(occurrence.event, occurrence.date)}
          />
        </TabsContent>

        <TabsContent value="week">
          <WeekGrid
            days={week}
            occurrences={window.occurrences}
            weekStartsOn={settings.weekStartsOn}
            timeFormat={settings.timeFormat}
            onSelectDay={(date) => {
              setAnchor(date)
              setView('day')
            }}
            onSelectOccurrence={(occurrence) =>
              setEditing({ event: occurrence.event, date: occurrence.date })
            }
            onAddAt={(date) => {
              setFormDate(date)
              setFormOpen(true)
            }}
          />
        </TabsContent>

        <TabsContent value="month">
          <Card>
            <CardHeader
              title={formatMonthYear(anchor)}
              description="Tap a day to open it, or a block to edit it"
              icon={<CalendarDays />}
              action={
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate(`/analytics?from=${monthDays[0]}&to=${monthDays[monthDays.length - 1]}`)}
                >
                  Analyse month
                </Button>
              }
              flush
            />
            <CardBody>
              <div className="grid grid-cols-7 gap-1 text-center">
                {Array.from({ length: 7 }, (_, index) => {
                  const weekday = ((settings.weekStartsOn + index) % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6
                  return (
                    <span
                      key={weekday}
                      className="pb-1 text-[0.6rem] font-bold tracking-wider text-[var(--fg-subtle)] uppercase"
                    >
                      {WEEKDAY_LABELS[weekday]}
                    </span>
                  )
                })}
                {monthDays.map((day) => {
                  const list = byDay.get(day) ?? []
                  const inMonth = day.slice(0, 7) === anchor.slice(0, 7)
                  const totalMinutes = list.reduce((total, item) => total + item.durationMinutes, 0)
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        setAnchor(day)
                        setView('day')
                      }}
                      className={cn(
                        'min-h-[5.4rem] rounded-xl border p-1.5 text-left align-top transition-colors',
                        inMonth
                          ? 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--accent)]'
                          : 'border-transparent bg-[var(--surface-2)] text-[var(--fg-subtle)]',
                        isKeyToday(day) && 'ring-2 ring-[var(--accent)]',
                      )}
                    >
                      <span className="flex items-center justify-between">
                        <span
                          className={cn(
                            'text-xs font-bold',
                            isKeyToday(day) ? 'text-[var(--accent-ink)]' : '',
                          )}
                        >
                          {Number(day.slice(8, 10))}
                        </span>
                        {totalMinutes > 0 ? (
                          <span className="text-[0.55rem] text-[var(--fg-subtle)]">
                            {Math.round(totalMinutes / 60)}h
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 block space-y-0.5">
                        {list.slice(0, 3).map((occurrence) => (
                          <span
                            key={`${occurrence.event.id}-${occurrence.date}`}
                            className="block truncate rounded px-1 py-px text-[0.58rem] font-semibold"
                            style={CATEGORY_META[occurrence.event.category].style}
                            title={occurrence.event.title}
                          >
                            {occurrence.event.title}
                          </span>
                        ))}
                        {list.length > 3 ? (
                          <span className="block text-[0.55rem] text-[var(--fg-subtle)]">
                            +{list.length - 3} more
                          </span>
                        ) : null}
                      </span>
                    </button>
                  )
                })}
              </div>
            </CardBody>
          </Card>
        </TabsContent>

        <TabsContent value="agenda">
          <Card>
            <CardHeader
              title="Agenda"
              description="Everything from today onwards, grouped by day"
              icon={<List />}
              flush
            />
            <CardBody className="space-y-4">
              {agendaDays.length === 0 ? (
                <p className="py-6 text-center text-xs text-[var(--fg-muted)]">
                  No upcoming blocks from this date. Add one, or switch back to the month view.
                </p>
              ) : (
                agendaDays.map(([day, list]) => (
                  <div key={day}>
                    <div className="mb-1.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAnchor(day)
                          setView('day')
                        }}
                        className="text-xs font-bold text-[var(--fg)] hover:text-[var(--accent-ink)]"
                      >
                        {relativeDayLabel(day)}
                      </button>
                      <span className="text-[0.62rem] text-[var(--fg-subtle)]">
                        {formatDayLabel(day, { withYear: true })}
                      </span>
                      <span className="h-px flex-1 bg-[var(--line)]" />
                      <Chip tone="neutral">
                        {list.reduce((total, item) => total + item.durationMinutes, 0)} min
                      </Chip>
                    </div>
                    <ul className="space-y-1">
                      {list.map((occurrence) => {
                        const meta = CATEGORY_META[occurrence.event.category]
                        return (
                          <li key={`${occurrence.event.id}-${occurrence.date}`}>
                            <button
                              type="button"
                              onClick={() =>
                                setEditing({ event: occurrence.event, date: occurrence.date })
                              }
                              className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--line)] px-2.5 py-2 text-left transition-colors hover:border-[var(--accent)]"
                            >
                              <span
                                className="w-24 shrink-0 rounded-lg px-1.5 py-1 text-center text-[0.65rem] font-bold"
                                style={meta.style}
                              >
                                {formatClock(occurrence.startTime, settings)}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-xs font-semibold">
                                  {occurrence.event.title}
                                </span>
                                <span className="block text-[0.6rem] text-[var(--fg-subtle)]">
                                  {meta.label} · {occurrence.durationMinutes} min ·{' '}
                                  {occurrence.event.status}
                                </span>
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </TabsContent>
      </Tabs>

      <EventFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        defaultDate={formDate}
        onSaved={() => setFormOpen(false)}
      />
      <EventFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        event={editing?.event ?? null}
        occurrenceDate={editing?.date}
      />
    </div>
  )
}
