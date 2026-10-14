import { describe, expect, it } from 'vitest'
import {
  computeSessionMath,
  currentNight,
  nextWakeMillis,
  plannedNight,
  sleepEventsForRange,
  sleepEventId,
} from './sleep-events'
import { createDefaultSleepSchedule } from '@/config/defaults'
import type { SleepSchedule, SleepSession } from '@/types'

const schedule: SleepSchedule = createDefaultSleepSchedule(0)

function session(overrides: Partial<SleepSession> = {}): SleepSession {
  return {
    id: 'sleep-1',
    date: '2026-03-02',
    startAt: 0,
    endAt: null,
    sleepOnsetAt: null,
    awakenings: [],
    awakeMinutes: 0,
    timeInBedMinutes: 0,
    estimatedSleepMinutes: null,
    manual: false,
    confirmed: false,
    quality: null,
    notes: '',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('plannedNight', () => {
  it('resolves a weeknight that crosses midnight', () => {
    // 2026-03-02 is a Monday, which is a week night in the default schedule.
    const night = plannedNight(schedule, '2026-03-02')
    expect(night).not.toBeNull()
    expect(night?.bedtime).toBe('23:00')
    expect(night?.wakeTime).toBe('07:00')
    expect(night?.timeInBedMinutes).toBe(8 * 60)
    expect(night?.wakeDate).toBe('2026-03-03')
    expect(night?.sleepOnsetMinutes).toBe(15)
    expect(night?.expectedSleepMinutes).toBe(8 * 60 - 15)
    expect(night?.source).toBe('weekday')
  })

  it('uses the weekend schedule on a weekend night', () => {
    // 2026-03-06 is a Friday, a weekend night by default.
    const night = plannedNight(schedule, '2026-03-06')
    expect(night?.source).toBe('weekend')
    expect(night?.bedtime).toBe('00:00')
    expect(night?.wakeTime).toBe('08:30')
    // Midnight bedtime rolls onto the same day's morning.
    expect(night?.wakeDate).toBe('2026-03-06')
  })

  it('lets a single-night exception override the recurring schedule', () => {
    const night = plannedNight(schedule, '2026-03-02', [
      {
        id: 'exc',
        date: '2026-03-02',
        bedtime: '01:30',
        wakeTime: '09:00',
        note: '',
        createdAt: 0,
      },
    ])
    expect(night?.source).toBe('exception')
    expect(night?.bedtime).toBe('01:30')
    expect(night?.wakeTime).toBe('09:00')
    expect(night?.timeInBedMinutes).toBe(7 * 60 + 30)
    // 01:30 to 09:00 does not cross midnight in the calculation.
    expect(night?.wakeDate).toBe('2026-03-02')
  })

  it('returns null when the schedule is disabled with no exception', () => {
    const disabled: SleepSchedule = { ...schedule, enabled: false }
    expect(plannedNight(disabled, '2026-03-02')).toBeNull()
  })
})

describe('sleepEventsForRange', () => {
  it('generates one sleep block per night with a stable id', () => {
    const events = sleepEventsForRange(schedule, '2026-03-02', '2026-03-04')
    const sleepEvents = events.filter((event) => event.category === 'sleep')
    expect(sleepEvents).toHaveLength(3)
    expect(sleepEvents[0].id).toBe(sleepEventId('2026-03-02'))
    // The block is marked overnight so the timetable renders it across midnight.
    expect(sleepEvents[0].overnight).toBe(true)
    expect(sleepEvents[0].plannedMinutes).toBe(8 * 60)
  })

  it('marks a night as completed only when a session exists', () => {
    const events = sleepEventsForRange(
      schedule,
      '2026-03-02',
      '2026-03-03',
      [],
      [session({ date: '2026-03-02', timeInBedMinutes: 470, endAt: 1 })],
    )
    const recorded = events.find((event) => event.date === '2026-03-02' && event.category === 'sleep')
    const planned = events.find((event) => event.date === '2026-03-03' && event.category === 'sleep')
    expect(recorded?.status).toBe('completed')
    expect(planned?.status).toBe('planned')
  })

  it('adds a wind-down block when asked', () => {
    const events = sleepEventsForRange(schedule, '2026-03-02', '2026-03-02', [], [], {
      includeWindDown: true,
    })
    const windDown = events.find((event) => event.id === 'winddown__2026-03-02')
    expect(windDown).toBeDefined()
    expect(windDown?.startTime).toBe('22:30')
    expect(windDown?.endTime).toBe('23:00')
  })
})

describe('computeSessionMath', () => {
  const startAt = new Date('2026-03-02T23:00:00').getTime()

  it('reports time in bed and a null estimate when onset is unknown', () => {
    const result = computeSessionMath({
      startAt,
      endAt: startAt + 8 * 60 * 60_000,
      sleepOnsetAt: null,
      awakeMinutes: 0,
      awakenings: [],
    })
    expect(result.timeInBedMinutes).toBe(480)
    // Never claims time in bed was actual sleep.
    expect(result.estimatedSleepMinutes).toBeNull()
  })

  it('subtracts onset delay and awake time from the estimate', () => {
    const result = computeSessionMath({
      startAt,
      endAt: startAt + 8 * 60 * 60_000,
      sleepOnsetAt: startAt + 20 * 60_000,
      awakeMinutes: 25,
      awakenings: [],
    })
    expect(result.timeInBedMinutes).toBe(480)
    expect(result.estimatedSleepMinutes).toBe(480 - 20 - 25)
    expect(result.awakeMinutes).toBe(25)
  })

  it('adds up recorded awakenings', () => {
    const result = computeSessionMath({
      startAt,
      endAt: startAt + 7 * 60 * 60_000,
      sleepOnsetAt: startAt,
      awakeMinutes: 0,
      awakenings: [{ minutes: 10 }, { minutes: 15 }],
    })
    expect(result.awakeMinutes).toBe(25)
    expect(result.estimatedSleepMinutes).toBe(7 * 60 - 25)
  })

  it('never returns a negative sleep estimate', () => {
    const result = computeSessionMath({
      startAt,
      endAt: startAt + 30 * 60_000,
      sleepOnsetAt: startAt,
      awakeMinutes: 90,
      awakenings: [],
    })
    expect(result.estimatedSleepMinutes).toBe(0)
  })

  it('ignores an onset recorded before bedtime', () => {
    const result = computeSessionMath({
      startAt,
      endAt: startAt + 60 * 60_000,
      sleepOnsetAt: startAt - 60 * 60_000,
      awakeMinutes: 0,
      awakenings: [],
    })
    expect(result.estimatedSleepMinutes).toBe(60)
  })
})

describe('currentNight', () => {
  it('finds the night that covers the given instant', () => {
    // 2026-03-03T02:00 is inside the night that began 2026-03-02 at 23:00.
    const inside = new Date('2026-03-03T02:00:00').getTime()
    expect(currentNight(schedule, [], inside)?.date).toBe('2026-03-02')
  })

  it('returns null in the middle of the day', () => {
    const midday = new Date('2026-03-03T13:00:00').getTime()
    expect(currentNight(schedule, [], midday)).toBeNull()
  })
})

describe('nextWakeMillis', () => {
  it('returns a wake time in the future', () => {
    const now = new Date('2026-03-03T13:00:00').getTime()
    const wake = nextWakeMillis(schedule, [], now)
    expect(wake).not.toBeNull()
    expect((wake as number) > now).toBe(true)
  })
})
