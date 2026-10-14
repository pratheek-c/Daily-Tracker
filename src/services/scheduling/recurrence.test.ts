import { describe, expect, it } from 'vitest'
import {
  buildOccurrences,
  createDailyRule,
  createWeeklyRule,
  detectConflicts,
  expandRecurrence,
  occurrenceFromEvent,
  shiftOccurrence,
} from './recurrence'
import type { RecurrenceRule, ScheduledEvent, Weekday } from '@/types'

function makeEvent(overrides: Partial<ScheduledEvent> = {}): ScheduledEvent {
  return {
    id: 'evt-1',
    title: 'Study block',
    description: '',
    category: 'study',
    date: '2026-03-02',
    startTime: '09:00',
    endTime: '10:30',
    overnight: false,
    status: 'planned',
    priority: 'medium',
    subjectId: null,
    projectId: null,
    projectTaskId: null,
    taskId: null,
    location: '',
    meetingUrl: '',
    reminders: { enabled: true, offsetsMinutes: [10] },
    recurrence: null,
    seriesId: null,
    occurrenceDate: null,
    isSeriesTemplate: false,
    conflictAcknowledged: false,
    plannedMinutes: 90,
    actualMinutes: null,
    startedAt: null,
    finishedAt: null,
    notes: '',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

function template(rule: RecurrenceRule, overrides: Partial<ScheduledEvent> = {}): ScheduledEvent {
  return makeEvent({
    id: 'series-1',
    seriesId: 'series-1',
    isSeriesTemplate: true,
    recurrence: rule,
    occurrenceDate: rule.startDate,
    date: rule.startDate,
    ...overrides,
  })
}

describe('expandRecurrence', () => {
  it('produces every day for a daily rule', () => {
    const rule = createDailyRule('2026-03-02') // Monday
    expect(expandRecurrence(rule, '2026-03-02', '2026-03-05')).toEqual([
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
      '2026-03-05',
    ])
  })

  it('honours a daily interval', () => {
    const rule: RecurrenceRule = { ...createDailyRule('2026-03-02'), interval: 2 }
    expect(expandRecurrence(rule, '2026-03-02', '2026-03-09')).toEqual([
      '2026-03-02',
      '2026-03-04',
      '2026-03-06',
      '2026-03-08',
    ])
  })

  it('selects only weekdays for a weekdays rule', () => {
    const rule: RecurrenceRule = { ...createDailyRule('2026-03-02'), frequency: 'weekdays' }
    // 2026-03-02 is a Monday, so the 7th and 8th are the weekend.
    expect(expandRecurrence(rule, '2026-03-02', '2026-03-09')).toEqual([
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
      '2026-03-05',
      '2026-03-06',
      '2026-03-09',
    ])
  })

  it('selects only weekend days for a weekends rule', () => {
    const rule: RecurrenceRule = { ...createDailyRule('2026-03-02'), frequency: 'weekends' }
    expect(expandRecurrence(rule, '2026-03-02', '2026-03-09')).toEqual([
      '2026-03-07',
      '2026-03-08',
    ])
  })

  it('repeats on the anchor weekday for a weekly rule', () => {
    const rule = createWeeklyRule('2026-03-02') // Monday
    expect(expandRecurrence(rule, '2026-03-02', '2026-03-20')).toEqual([
      '2026-03-02',
      '2026-03-09',
      '2026-03-16',
    ])
  })

  it('supports multi-weekday weekly patterns', () => {
    const days: Weekday[] = [1, 4] // Mon + Thu
    const rule = createWeeklyRule('2026-03-02', days)
    expect(expandRecurrence(rule, '2026-03-02', '2026-03-13')).toEqual([
      '2026-03-02',
      '2026-03-05',
      '2026-03-09',
      '2026-03-12',
    ])
  })

  it('repeats every second week for an interval of 2', () => {
    const rule: RecurrenceRule = { ...createWeeklyRule('2026-03-02'), interval: 2 }
    expect(expandRecurrence(rule, '2026-03-02', '2026-03-24')).toEqual([
      '2026-03-02',
      '2026-03-16',
    ])
  })

  it('never emits a date before the rule start', () => {
    const rule = createDailyRule('2026-03-10')
    expect(expandRecurrence(rule, '2026-03-01', '2026-03-12')).toEqual([
      '2026-03-10',
      '2026-03-11',
      '2026-03-12',
    ])
  })

  it('stops at the rule end date', () => {
    const rule: RecurrenceRule = { ...createDailyRule('2026-03-02'), endDate: '2026-03-04' }
    expect(expandRecurrence(rule, '2026-03-01', '2026-03-10')).toEqual([
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
    ])
  })

  it('applies a count limit exactly once across windows', () => {
    const rule: RecurrenceRule = { ...createDailyRule('2026-03-02'), count: 3 }
    expect(expandRecurrence(rule, '2026-03-01', '2026-03-31')).toEqual([
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
    ])
    // A later window must not restart the count.
    expect(expandRecurrence(rule, '2026-03-10', '2026-03-31')).toEqual([])
  })

  it('returns nothing for an inverted window', () => {
    const rule = createDailyRule('2026-03-02')
    expect(expandRecurrence(rule, '2026-03-10', '2026-03-01')).toEqual([])
  })
})

describe('occurrenceFromEvent', () => {
  it('matches start and end on the same day', () => {
    const occurrence = occurrenceFromEvent(makeEvent())
    expect(occurrence.durationMinutes).toBe(90)
    expect(occurrence.overnight).toBe(false)
  })

  it('rolls an overnight block onto the next day', () => {
    const occurrence = occurrenceFromEvent(
      makeEvent({ startTime: '23:00', endTime: '07:00', category: 'sleep' }),
    )
    expect(occurrence.overnight).toBe(true)
    expect(occurrence.durationMinutes).toBe(8 * 60)
    expect(new Date(occurrence.endMillis).getDate()).toBe(new Date(occurrence.startMillis).getDate() + 1)
  })
})

describe('buildOccurrences', () => {
  it('expands a series and applies a cancelled exception', () => {
    const rule = createDailyRule('2026-03-02')
    const events = [template(rule)]
    const all = buildOccurrences(events, '2026-03-02', '2026-03-04')
    expect(all.map((occurrence) => occurrence.date)).toEqual([
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
    ])

    const withException = buildOccurrences(events, '2026-03-02', '2026-03-04', [
      { seriesId: 'series-1', originalDate: '2026-03-03', kind: 'cancelled' },
    ])
    expect(withException.map((occurrence) => occurrence.date)).toEqual([
      '2026-03-02',
      '2026-03-04',
    ])
  })

  it('moves a single occurrence without touching the rest of the series', () => {
    const rule = createDailyRule('2026-03-02')
    const occurrences = buildOccurrences([template(rule)], '2026-03-02', '2026-03-03', [
      {
        seriesId: 'series-1',
        originalDate: '2026-03-03',
        kind: 'moved',
        movedToDate: '2026-03-03',
        movedToStart: '14:00',
        movedToEnd: '15:00',
      },
    ])
    const moved = occurrences.find((occurrence) => occurrence.date === '2026-03-03')
    expect(moved?.startTime).toBe('14:00')
    expect(moved?.durationMinutes).toBe(60)
    // The untouched day keeps its original time.
    expect(occurrences.find((occurrence) => occurrence.date === '2026-03-02')?.startTime).toBe('09:00')
  })

  it('does not render the template row itself', () => {
    const rule = createDailyRule('2026-03-20')
    const occurrences = buildOccurrences([template(rule)], '2026-03-02', '2026-03-03')
    expect(occurrences).toHaveLength(0)
  })

  it('returns stored single events inside the window only', () => {
    const events = [
      makeEvent({ id: 'a', date: '2026-03-02' }),
      makeEvent({ id: 'b', date: '2026-03-20' }),
    ]
    const occurrences = buildOccurrences(events, '2026-03-01', '2026-03-05')
    expect(occurrences.map((occurrence) => occurrence.event.id)).toEqual(['a'])
  })
})

describe('detectConflicts', () => {
  it('finds an overlap and reports its length', () => {
    const a = occurrenceFromEvent(makeEvent({ id: 'a', startTime: '09:00', endTime: '10:30' }))
    const b = occurrenceFromEvent(makeEvent({ id: 'b', startTime: '10:00', endTime: '11:00' }))
    const conflicts = detectConflicts([a, b])
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].overlapMinutes).toBe(30)
  })

  it('treats back-to-back blocks as no conflict', () => {
    const a = occurrenceFromEvent(makeEvent({ id: 'a', startTime: '09:00', endTime: '10:00' }))
    const b = occurrenceFromEvent(makeEvent({ id: 'b', startTime: '10:00', endTime: '11:00' }))
    expect(detectConflicts([a, b])).toHaveLength(0)
  })

  it('flags study planned over the sleep block', () => {
    const sleep = occurrenceFromEvent(
      makeEvent({ id: 'sleep', category: 'sleep', startTime: '23:00', endTime: '07:00' }),
    )
    const study = occurrenceFromEvent(
      makeEvent({ id: 'late', startTime: '23:30', endTime: '00:30' }),
    )
    const conflicts = detectConflicts([sleep, study])
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].overlapMinutes).toBe(60)
  })

  it('never reports the same event as conflicting with itself', () => {
    const occurrence = occurrenceFromEvent(makeEvent())
    expect(detectConflicts([occurrence, occurrence])).toHaveLength(0)
  })
})

describe('shiftOccurrence', () => {
  it('moves a block by minutes within the same day', () => {
    const occurrence = occurrenceFromEvent(makeEvent({ startTime: '09:00', endTime: '10:00' }))
    expect(shiftOccurrence(occurrence, 60)).toEqual({
      date: '2026-03-02',
      startTime: '10:00',
      endTime: '11:00',
    })
  })

  it('rolls into the next day when pushed past midnight', () => {
    const occurrence = occurrenceFromEvent(makeEvent({ startTime: '23:00', endTime: '23:30' }))
    expect(shiftOccurrence(occurrence, 90)).toEqual({
      date: '2026-03-03',
      startTime: '00:30',
      endTime: '01:00',
    })
  })

  it('rolls backwards into the previous day', () => {
    const occurrence = occurrenceFromEvent(makeEvent({ startTime: '00:30', endTime: '01:00' }))
    expect(shiftOccurrence(occurrence, -60)).toEqual({
      date: '2026-03-01',
      startTime: '23:30',
      endTime: '00:00',
    })
  })
})
