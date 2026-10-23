import type { LocationForecast } from '../domain/types'
import { openDatabase, requestToPromise, txDone } from './db'

export interface ForecastCacheEntry {
  key: string
  forecast: LocationForecast
  storedAt: number
  expiresAt: number
}

export const FORECAST_TTL_MS = 3 * 60 * 60 * 1000

/** Clave por coordenadas (3 decimales ≈ 110 m) y ventana solicitada. */
export function forecastCacheKey(lat: number, lon: number, elevation: number | null, days: number): string {
  const ele = elevation === null ? 'x' : Math.round(elevation / 10)
  return `${lat.toFixed(3)},${lon.toFixed(3)},${ele},${days}`
}

export async function getCachedForecasts(
  keys: readonly string[],
  now = Date.now(),
): Promise<Map<string, LocationForecast>> {
  const out = new Map<string, LocationForecast>()
  if (keys.length === 0) return out
  const db = await openDatabase()
  const tx = db.transaction('forecastCache', 'readonly')
  const store = tx.objectStore('forecastCache')
  const records = await Promise.all(
    keys.map((key) => requestToPromise<ForecastCacheEntry | undefined>(store.get(key))),
  )
  await txDone(tx)
  for (let i = 0; i < keys.length; i++) {
    const record = records[i]
    if (record && record.expiresAt > now) out.set(keys[i], record.forecast)
  }
  return out
}

export async function putCachedForecasts(
  entries: readonly { key: string; forecast: LocationForecast }[],
  now = Date.now(),
): Promise<void> {
  if (entries.length === 0) return
  const db = await openDatabase()
  const tx = db.transaction('forecastCache', 'readwrite')
  const store = tx.objectStore('forecastCache')
  for (const e of entries) {
    const record: ForecastCacheEntry = {
      key: e.key,
      forecast: e.forecast,
      storedAt: now,
      expiresAt: now + FORECAST_TTL_MS,
    }
    store.put(record)
  }
  await txDone(tx)
}

/** Purga entradas caducadas; tolera fallos de almacenamiento. */
export async function purgeExpiredForecastCache(now = Date.now()): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction('forecastCache', 'readwrite')
  const store = tx.objectStore('forecastCache')
  const index = store.index('expiresAt')
  const expired = await requestToPromise<IDBValidKey[]>(index.getAll(IDBKeyRange.upperBound(now)))
  for (const key of expired) store.delete(key)
  await txDone(tx)
}

/** Borra toda la caché meteorológica (acción de usuario). */
export async function clearForecastCache(): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction('forecastCache', 'readwrite')
  tx.objectStore('forecastCache').clear()
  await txDone(tx)
}
