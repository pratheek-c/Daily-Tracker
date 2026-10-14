import { getDatabase } from '@/db/database'
import { DexieChangeSink, DexieStorage } from './dexie-storage'
import type { Storage } from './storage'

const DEVICE_ID_KEY = 'adt.deviceId'

function deviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY)
    if (existing) return existing
    const created = `dev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
    localStorage.setItem(DEVICE_ID_KEY, created)
    return created
  } catch {
    return 'dev_unknown'
  }
}

let storage: Storage | null = null

/**
 * The single storage instance the app uses.
 *
 * Everything above this line is storage-agnostic, so swapping in a
 * `SupabaseStorage` (or a syncing wrapper around `DexieStorage`) later means
 * changing this one factory — not the pages.
 */
export function getStorage(): Storage {
  if (!storage) {
    const db = getDatabase()
    storage = new DexieStorage(db, { changeSink: new DexieChangeSink(db, deviceId()) })
  }
  return storage
}

export function setStorageForTesting(next: Storage | null) {
  storage = next
}

export type { Storage } from './storage'
