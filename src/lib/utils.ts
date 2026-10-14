import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { ID } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Collision-resistant id that also works on insecure origins (no crypto.randomUUID). */
export function newId(prefix = ''): ID {
  const g = globalThis as { crypto?: Crypto }
  let raw: string
  if (g.crypto && typeof g.crypto.randomUUID === 'function') {
    raw = g.crypto.randomUUID()
  } else {
    const bytes = new Uint8Array(16)
    if (g.crypto && typeof g.crypto.getRandomValues === 'function') {
      g.crypto.getRandomValues(bytes)
    } else {
      for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
    }
    raw = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  }
  return prefix ? `${prefix}_${raw}` : raw
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

export function round(value: number, decimals = 0) {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/** Percentage guarded against division by zero. */
export function percent(part: number, whole: number, decimals = 0) {
  if (!whole || whole <= 0) return 0
  return round((part / whole) * 100, decimals)
}

/** `90` -> `1h 30m`, `45` -> `45m`. */
export function formatMinutes(totalMinutes: number, opts: { compact?: boolean } = {}) {
  const minutes = Math.max(0, Math.round(totalMinutes))
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (opts.compact) {
    if (hours && rest) return `${hours}h${rest}`
    if (hours) return `${hours}h`
    return `${rest}m`
  }
  if (hours && rest) return `${hours}h ${rest}m`
  if (hours) return `${hours}h`
  return `${rest}m`
}

export function formatSeconds(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function minutesBetween(from: number, to: number) {
  return Math.max(0, Math.round((to - from) / 60000))
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, waitMs = 250) {
  let handle: ReturnType<typeof setTimeout> | undefined
  return (...args: A) => {
    if (handle) clearTimeout(handle)
    handle = setTimeout(() => fn(...args), waitMs)
  }
}

export function groupBy<T, K extends string>(items: T[], key: (item: T) => K) {
  const out = {} as Record<K, T[]>
  for (const item of items) {
    const k = key(item)
    if (!out[k]) out[k] = []
    out[k].push(item)
  }
  return out
}

export function sortBy<T>(items: T[], compare: (a: T, b: T) => number) {
  return [...items].sort(compare)
}

export function unique<T>(items: T[]) {
  return Array.from(new Set(items))
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function downloadText(filename: string, text: string, mime = 'text/plain;charset=utf-8') {
  downloadBlob(filename, new Blob([text], { type: mime }))
}

export function safeJsonParse<T>(text: string): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) as T }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Invalid JSON' }
  }
}

export function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '♡'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
