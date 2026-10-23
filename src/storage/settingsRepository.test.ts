import { beforeEach, describe, expect, it } from 'vitest'
import { createDefaultSettings } from '../domain/settings'
import type { TrackRecord } from '../domain/types'
import { resetDatabaseConnection } from './db'
import { clearSettings, loadSettings, saveSettingsNow } from './settingsRepository'
import { clearTracks, listTracks, putTrack, removeTrack } from './tracksRepository'

beforeEach(async () => {
  resetDatabaseConnection()
  await clearSettings().catch(() => undefined)
  await clearTracks().catch(() => undefined)
})

describe('repositorio de preferencias', () => {
  it('sin datos guardados devuelve los valores por defecto', async () => {
    const s = await loadSettings(new Date('2026-10-23T10:00:00'))
    expect(s.date).toBe('2026-10-24')
    expect(s.planMode).toBe('place')
  })

  it('guarda y recupera preferencias completas', async () => {
    const settings = {
      ...createDefaultSettings(new Date('2026-10-23T10:00:00')),
      planMode: 'gpx' as const,
      place: { name: 'Segovia', lat: 40.94, lon: -4.1 },
      avgSpeedKmh: 31.5,
      sensitivity: 'friolero' as const,
      lastTrackId: 't1',
    }
    await saveSettingsNow(settings)
    const loaded = await loadSettings(new Date('2026-10-23T10:00:00'))
    expect(loaded.planMode).toBe('gpx')
    expect(loaded.place?.name).toBe('Segovia')
    expect(loaded.avgSpeedKmh).toBe(31.5)
    expect(loaded.sensitivity).toBe('friolero')
    expect(loaded.lastTrackId).toBe('t1')
  })

  it('recuperan tras "reiniciar" (nueva conexión a la base)', async () => {
    await saveSettingsNow({ ...createDefaultSettings(), circular: true })
    resetDatabaseConnection()
    const loaded = await loadSettings()
    expect(loaded.circular).toBe(true)
  })

  it('clearSettings borra las preferencias pero no los tracks', async () => {
    const track: TrackRecord = {
      id: 'track-1',
      name: 'Prueba',
      fileName: 'prueba.gpx',
      importedAt: Date.now(),
      points: [
        { lat: 40, lon: -3, ele: 100, time: null },
        { lat: 40.01, lon: -3, ele: 110, time: null },
      ],
      stats: {
        distanceKm: 1.1,
        ascentM: 10,
        descentM: 0,
        hasEle: true,
        hasTime: false,
        pointCount: 2,
      },
    }
    await putTrack(track)
    await clearSettings()

    const settings = await loadSettings()
    expect(settings.circular).toBe(false)
    const tracks = await listTracks()
    expect(tracks).toHaveLength(1)
    expect(tracks[0].id).toBe('track-1')

    await removeTrack('track-1')
    expect(await listTracks()).toHaveLength(0)
  })
})
