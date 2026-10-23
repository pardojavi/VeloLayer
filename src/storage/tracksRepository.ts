import type { TrackRecord } from '../domain/types'
import { openDatabase, requestToPromise, txDone } from './db'

/** Lista los tracks guardados, del más reciente al más antiguo. */
export async function listTracks(): Promise<TrackRecord[]> {
  const db = await openDatabase()
  const tx = db.transaction('tracks', 'readonly')
  const all = await requestToPromise<TrackRecord[]>(tx.objectStore('tracks').getAll())
  await txDone(tx)
  return (all ?? []).sort((a, b) => b.importedAt - a.importedAt)
}

export async function getTrack(id: string): Promise<TrackRecord | null> {
  const db = await openDatabase()
  const tx = db.transaction('tracks', 'readonly')
  const record = await requestToPromise<TrackRecord | undefined>(tx.objectStore('tracks').get(id))
  await txDone(tx)
  return record ?? null
}

export async function putTrack(record: TrackRecord): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction('tracks', 'readwrite')
  tx.objectStore('tracks').put(record)
  await txDone(tx)
}

export async function removeTrack(id: string): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction('tracks', 'readwrite')
  tx.objectStore('tracks').delete(id)
  await txDone(tx)
}

export async function clearTracks(): Promise<void> {
  const db = await openDatabase()
  const tx = db.transaction('tracks', 'readwrite')
  tx.objectStore('tracks').clear()
  await txDone(tx)
}
