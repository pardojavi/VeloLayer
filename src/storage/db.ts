import { AppError } from '../domain/errors'

export const DB_NAME = 'velolayer'
export const DB_VERSION = 1

export interface Migration {
  version: number
  migrate(db: IDBDatabase): void
}

/**
 * Migraciones de esquema. Cada versión nueva añade su migración; nunca se
 * reescriben las anteriores.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    migrate(db) {
      db.createObjectStore('settings', { keyPath: 'key' })
      db.createObjectStore('tracks', { keyPath: 'id' })
      const cache = db.createObjectStore('forecastCache', { keyPath: 'key' })
      cache.createIndex('expiresAt', 'expiresAt')
    },
  },
]

let dbPromise: Promise<IDBDatabase> | null = null

export function idbAvailable(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB !== null
}

export function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB: error desconocido'))
  })
}

export function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB: transacción fallida'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB: transacción abortada'))
  })
}

export function openDatabase(): Promise<IDBDatabase> {
  if (!idbAvailable()) {
    return Promise.reject(
      new AppError('storage', 'Este navegador no permite almacenamiento local (IndexedDB).'),
    )
  }
  if (dbPromise) return dbPromise

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = req.result
      for (const migration of MIGRATIONS) {
        if (migration.version > (event.oldVersion ?? 0)) migration.migrate(db)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () =>
      reject(new AppError('storage', 'No se ha podido abrir el almacenamiento local.'))
    req.onblocked = () =>
      reject(new AppError('storage', 'El almacenamiento local está bloqueado por otra pestaña.'))
  })

  // Si falla, se permite reintentar más adelante.
  dbPromise.catch(() => {
    dbPromise = null
  })

  return dbPromise
}

/** Cierra (y olvida) la conexión; útil en pruebas. */
export function resetDatabaseConnection(): void {
  dbPromise = null
}
