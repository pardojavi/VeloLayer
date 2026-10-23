import { AppError } from '../domain/errors'
import { createDefaultSettings, sanitizeSettings } from '../domain/settings'
import type { Settings } from '../domain/types'
import { openDatabase, requestToPromise, txDone } from './db'

const KEY = 'current'
const WRITE_DEBOUNCE_MS = 350

interface SettingsRecord {
  key: string
  value: Settings
  updatedAt: number
}

/** Lee las preferencias persistidas. Nunca devuelve datos inválidos. */
export async function loadSettings(now: Date = new Date()): Promise<Settings> {
  const db = await openDatabase()
  const tx = db.transaction('settings', 'readonly')
  const store = tx.objectStore('settings')
  const record = await requestToPromise<SettingsRecord | undefined>(store.get(KEY))
  await txDone(tx)
  if (!record || !record.value) return createDefaultSettings(now)
  return sanitizeSettings(record.value, now)
}

export async function saveSettingsNow(value: Settings): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction('settings', 'readwrite')
  const store = tx.objectStore('settings')
  const record: SettingsRecord = { key: KEY, value, updatedAt: Date.now() }
  store.put(record)
  await txDone(tx)
}

let pending: Settings | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let lastError: ((e: unknown) => void) | null = null

/** Escritura controlada: se agrupan los cambios rápidos en una sola escritura. */
export function saveSettingsDebounced(value: Settings, onError?: (e: unknown) => void): void {
  pending = value
  lastError = onError ?? null
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    const toWrite = pending
    pending = null
    timer = null
    if (!toWrite) return
    saveSettingsNow(toWrite).catch((e) => {
      lastError?.(e)
    })
  }, WRITE_DEBOUNCE_MS)
}

/** Borra las preferencias (no toca los tracks guardados). */
export async function clearSettings(): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction('settings', 'readwrite')
  tx.objectStore('settings').delete(KEY)
  await txDone(tx)
}

export function storageError(e: unknown): AppError {
  if (e instanceof AppError) return e
  return new AppError(
    'storage',
    'No se ha podido leer o guardar en el almacenamiento local del dispositivo.',
  )
}
