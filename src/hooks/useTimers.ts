import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '@/app/AppContext'
import { getStorage } from '@/services/persistence'
import { newId } from '@/lib/utils'
import { todayKey, toDateKey } from '@/lib/date'
import type { ID, StudySession, TimerState } from '@/types'

/* -------------------------------------------------------------------------- */
/* Elapsed-time maths                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Seconds elapsed for a timer snapshot.
 *
 * Elapsed time is *derived*, never accumulated by an interval: the snapshot
 * stores `accumulatedSeconds` plus the instant the current segment started, so
 * a refresh, a background tab or a device sleep all recover the exact value.
 */
export function elapsedSeconds(state: TimerState | undefined, now: number): number {
  if (!state) return 0
  const running = state.running && state.runningSince !== null ? (now - state.runningSince) / 1000 : 0
  return Math.max(0, Math.floor(state.accumulatedSeconds + running))
}

export function remainingSeconds(state: TimerState | undefined, now: number): number | null {
  if (!state || state.targetSeconds === null) return null
  return Math.max(0, state.targetSeconds - elapsedSeconds(state, now))
}

export function createTimerState(
  id: TimerState['id'],
  patch: Partial<TimerState> = {},
): TimerState {
  return {
    id,
    mode: 'idle',
    running: false,
    accumulatedSeconds: 0,
    runningSince: null,
    cycle: 0,
    subjectId: null,
    projectTaskId: null,
    taskId: null,
    eventId: null,
    targetSeconds: null,
    startedAt: null,
    updatedAt: Date.now(),
    ...patch,
  }
}

/* -------------------------------------------------------------------------- */
/* Pomodoro                                                                   */
/* -------------------------------------------------------------------------- */

export interface PomodoroState {
  mode: TimerState['mode']
  running: boolean
  elapsed: number
  remaining: number
  target: number
  cycle: number
  /** 0-1 progress through the current segment. */
  progress: number
  /** True for a moment right after a segment completes, for UI celebration. */
  justCompleted: boolean
  label: string
  start: () => void
  pause: () => void
  reset: () => void
  skip: () => void
  setMode: (mode: 'focus' | 'short-break' | 'long-break') => void
}

/**
 * Pomodoro timer.
 *
 * The observable state lives entirely in IndexedDB. A single watchdog effect
 * corrects the state whenever a segment has finished — including segments that
 * were supposed to end while the tab was closed — so no cycle is ever lost or
 * double-counted.
 */
export function usePomodoro(): PomodoroState {
  const { data, settings, now, saveStudySession } = useApp()
  const state = useMemo(
    () => data.timerStates.find((row) => row.id === 'pomodoro'),
    [data.timerStates],
  )
  const handleRef = useRef<number | null>(null)
  const [flash, setFlash] = useState(false)

  const mode = state?.mode ?? 'idle'
  const elapsed = elapsedSeconds(state, now)
  const target =
    state?.targetSeconds ??
    (mode === 'short-break'
      ? settings.shortBreakMinutes * 60
      : mode === 'long-break'
        ? settings.longBreakMinutes * 60
        : settings.focusMinutes * 60)
  const remaining = Math.max(0, target - elapsed)
  const progress = target <= 0 ? 0 : Math.min(1, elapsed / target)

  const write = async (patch: Partial<TimerState>) => {
    const storage = getStorage()
    const current =
      (await storage.getTimerState('pomodoro')) ?? createTimerState('pomodoro')
    await storage.putTimerState({ ...current, ...patch, id: 'pomodoro', updatedAt: Date.now() })
  }

  const beginSegment = async (nextMode: 'focus' | 'short-break' | 'long-break') => {
    const seconds =
      nextMode === 'short-break'
        ? settings.shortBreakMinutes * 60
        : nextMode === 'long-break'
          ? settings.longBreakMinutes * 60
          : settings.focusMinutes * 60
    await write({
      mode: nextMode,
      running: true,
      accumulatedSeconds: 0,
      runningSince: Date.now(),
      targetSeconds: seconds,
      startedAt: Date.now(),
    })
  }

  /**
   * Bank the finished segment and move to the next one. Called from the
   * watchdog, so it must be idempotent: it only fires when the elapsed time has
   * genuinely reached the target.
   */
  const completeSegment = async () => {
    const storage = getStorage()
    const current = await storage.getTimerState('pomodoro')
    if (!current || current.mode === 'idle' || current.targetSeconds === null) return
    const done = elapsedSeconds(current, Date.now())
    if (done < current.targetSeconds) return

    if (current.mode === 'focus') {
      const session: StudySession = {
        id: newId('study'),
        subjectId: current.subjectId,
        projectId: null,
        projectTaskId: current.projectTaskId,
        taskId: current.taskId,
        eventId: current.eventId,
        date: todayKey(),
        startedAt: current.startedAt ?? Date.now() - current.targetSeconds * 1000,
        endedAt: Date.now(),
        focusedSeconds: current.targetSeconds,
        breakSeconds: 0,
        pausedAt: null,
        status: 'completed',
        technique: 'pomodoro',
        pomodoroCycles: 1,
        notes: 'Pomodoro focus block',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await saveStudySession(session)

      const cycle = current.cycle + 1
      const useLong = settings.longBreakEvery > 0 && cycle % settings.longBreakEvery === 0
      await write({ cycle, accumulatedSeconds: 0, runningSince: null, running: false, mode: 'idle', targetSeconds: null })
      if (settings.soundEnabled) chime('focus-complete')
      await beginSegment(useLong ? 'long-break' : 'short-break')
      setFlash(true)
      window.setTimeout(() => setFlash(false), 900)
      return
    }

    // Break finished → back to focus.
    await write({ accumulatedSeconds: 0, runningSince: null, running: false, mode: 'idle', targetSeconds: null })
    if (settings.soundEnabled) chime('break-complete')
    if (settings.autoStartBreaks) await beginSegment('focus')
    setFlash(true)
    window.setTimeout(() => setFlash(false), 900)
  }

  // Single watchdog for both the countdown and automatic segment rollover.
  useEffect(() => {
    if (handleRef.current) window.clearInterval(handleRef.current)
    handleRef.current = window.setInterval(() => {
      void (async () => {
        const storage = getStorage()
        const current = await storage.getTimerState('pomodoro')
        if (!current || !current.running || current.targetSeconds === null) return
        if (elapsedSeconds(current, Date.now()) >= current.targetSeconds) await completeSegment()
      })()
    }, 1000)
    return () => {
      if (handleRef.current) window.clearInterval(handleRef.current)
    }
    // `completeSegment` intentionally re-created each render so the watchdog
    // always sees the latest settings.
  })

  return {
    mode,
    running: state?.running ?? false,
    elapsed,
    remaining,
    target,
    cycle: state?.cycle ?? 0,
    progress,
    justCompleted: flash,
    label:
      mode === 'short-break' ? 'Short break' : mode === 'long-break' ? 'Long break' : mode === 'focus' ? 'Focus' : 'Ready',
    start: () => {
      void (async () => {
        const storage = getStorage()
        const current = await storage.getTimerState('pomodoro')
        if (!current || current.mode === 'idle') {
          await beginSegment('focus')
          return
        }
        await write({ running: true, runningSince: Date.now() })
      })()
    },
    pause: () => {
      void (async () => {
        const storage = getStorage()
        const current = await storage.getTimerState('pomodoro')
        if (!current) return
        await write({
          running: false,
          accumulatedSeconds: elapsedSeconds(current, Date.now()),
          runningSince: null,
        })
      })()
    },
    reset: () => {
      void write({
        mode: 'idle',
        running: false,
        accumulatedSeconds: 0,
        runningSince: null,
        targetSeconds: null,
        startedAt: null,
      })
    },
    skip: () => {
      void (async () => {
        const current = await getStorage().getTimerState('pomodoro')
        if (!current || current.mode === 'idle') return
        if (current.mode === 'focus') {
          await write({ accumulatedSeconds: 0, runningSince: null, running: false, mode: 'idle', targetSeconds: null })
          await beginSegment('short-break')
        } else {
          await write({ accumulatedSeconds: 0, runningSince: null, running: false, mode: 'idle', targetSeconds: null })
          await beginSegment('focus')
        }
      })()
    },
    setMode: (next) => {
      void beginSegment(next)
    },
  } as PomodoroState
}

/* -------------------------------------------------------------------------- */
/* Manual stopwatch (study sessions and activity tracking)                    */
/* -------------------------------------------------------------------------- */

export interface StopwatchState {
  running: boolean
  elapsed: number
  start: () => void
  pause: () => void
  reset: () => void
  bank: () => number
}

export function useStopwatch(id: TimerState['id'], initial: Partial<TimerState> = {}): StopwatchState {
  const { data, now } = useApp()
  const state = useMemo(() => data.timerStates.find((row) => row.id === id), [data.timerStates, id])
  const elapsed = elapsedSeconds(state, now)

  const write = async (patch: Partial<TimerState>) => {
    const storage = getStorage()
    const current = (await storage.getTimerState(id)) ?? createTimerState(id, initial)
    await storage.putTimerState({ ...current, ...patch, id, updatedAt: Date.now() })
  }

  return {
    running: state?.running ?? false,
    elapsed,
    start: () => {
      void write({ running: true, runningSince: Date.now(), startedAt: state?.startedAt ?? Date.now() })
    },
    pause: () => {
      void (async () => {
        const current = await getStorage().getTimerState(id)
        if (!current) return
        await write({
          running: false,
          accumulatedSeconds: elapsedSeconds(current, Date.now()),
          runningSince: null,
        })
      })()
    },
    reset: () => {
      void write({ running: false, accumulatedSeconds: 0, runningSince: null, targetSeconds: null, startedAt: null })
    },
    bank: () => elapsed,
  }
}

/* -------------------------------------------------------------------------- */
/* Soft chime (no asset download; generated with Web Audio)                   */
/* -------------------------------------------------------------------------- */

export function chime(kind: 'focus-complete' | 'break-complete' | 'tick' = 'focus-complete') {
  if (typeof window === 'undefined') return
  const AudioCtor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtor) return
  try {
    const context = new AudioCtor()
    const notes = kind === 'tick' ? [660] : kind === 'break-complete' ? [523.25, 783.99] : [587.33, 880]
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.value = 0
      oscillator.connect(gain)
      gain.connect(context.destination)
      const startAt = context.currentTime + index * 0.18
      gain.gain.setValueAtTime(0, startAt)
      gain.gain.linearRampToValueAtTime(0.14, startAt + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.42)
      oscillator.start(startAt)
      oscillator.stop(startAt + 0.45)
    })
    window.setTimeout(() => void context.close(), 1400)
  } catch {
    // Audio is a nicety; never let it break a timer transition.
  }
}

/** Live-updating "time since" label for running sessions. */
export function useElapsedLabel(state: TimerState | undefined, now: number) {
  const seconds = elapsedSeconds(state, now)
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

/* -------------------------------------------------------------------------- */
/* Study session timer                                                        */
/* -------------------------------------------------------------------------- */

export interface StudyTimerControls {
  activeSession: StudySession | undefined
  running: boolean
  elapsed: number
  label: string
  start: (input: {
    subjectId: ID | null
    projectId?: ID | null
    projectTaskId?: ID | null
    taskId?: ID | null
    eventId?: ID | null
  }) => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  finish: (notes?: string, manualMinutes?: number) => Promise<StudySession | null>
  discard: () => Promise<void>
  correctDuration: (minutes: number) => Promise<void>
}

/**
 * Exactly one study session may run at a time — starting a new one while
 * another is active is prevented rather than silently stacking timers.
 */
export function useStudyTimer(): StudyTimerControls {
  const { data, now, saveStudySession, settings } = useApp()
  const activeSession = useMemo(
    () => data.studySessions.find((session) => session.status === 'active' || session.status === 'paused'),
    [data.studySessions],
  )

  const focusedSeconds = (() => {
    if (!activeSession) return 0
    const base = activeSession.focusedSeconds
    if (activeSession.status === 'active' && !activeSession.pausedAt) {
      return base + Math.max(0, Math.floor((now - activeSession.startedAt) / 1000))
    }
    return base
  })()

  const write = async (patch: Partial<StudySession>) => {
    if (!activeSession) return
    await saveStudySession({ ...activeSession, ...patch, updatedAt: Date.now() })
  }

  return {
    activeSession,
    running: activeSession?.status === 'active',
    elapsed: focusedSeconds,
    label: formatClockLabel(focusedSeconds),
    start: async (input) => {
      if (activeSession) return
      const stamp = Date.now()
      const session: StudySession = {
        id: newId('study'),
        subjectId: input.subjectId,
        projectId: input.projectId ?? null,
        projectTaskId: input.projectTaskId ?? null,
        taskId: input.taskId ?? null,
        eventId: input.eventId ?? null,
        date: toDateKey(stamp),
        startedAt: stamp,
        endedAt: null,
        focusedSeconds: 0,
        breakSeconds: 0,
        pausedAt: null,
        status: 'active',
        technique: 'free',
        pomodoroCycles: 0,
        notes: '',
        createdAt: stamp,
        updatedAt: stamp,
      }
      await saveStudySession(session)
      if (settings.soundEnabled) chime('tick')
    },
    pause: async () => {
      if (!activeSession) return
      await write({
        status: 'paused',
        focusedSeconds,
        startedAt: Date.now(),
        pausedAt: Date.now(),
      })
    },
    resume: async () => {
      if (!activeSession) return
      await write({ status: 'active', startedAt: Date.now(), pausedAt: null })
    },
    finish: async (notes, manualMinutes) => {
      if (!activeSession) return null
      const stamp = Date.now()
      const totalSeconds = manualMinutes !== undefined ? manualMinutes * 60 : focusedSeconds
      const finished: StudySession = {
        ...activeSession,
        endedAt: stamp,
        focusedSeconds: totalSeconds,
        pausedAt: null,
        status: 'completed',
        notes: notes ?? activeSession.notes,
        updatedAt: stamp,
      }
      await saveStudySession(finished)
      return finished
    },
    discard: async () => {
      if (!activeSession) return
      await getStorage().deleteStudySession(activeSession.id)
    },
    correctDuration: async (minutes) => {
      await write({ focusedSeconds: Math.max(0, Math.round(minutes * 60)) })
    },
  }
}

function formatClockLabel(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
